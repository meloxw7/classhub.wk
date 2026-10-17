import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import app from './app';
import { pool } from './lib/db';
import { hashToken } from './lib/tokens';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('fluxos de negócio (banco real, sandbox próprio)', () => {
  const startedAt = new Date();
  let professorToken = '';
  let alunoToken = '';
  let alunoId = '';
  let subjectId = '';
  let materialId = '';
  let noticeId = '';
  let questionId = '';
  let roomId = '';
  let assignmentId = '';
  let submissionId = '';
  let refId = '';
  const createdHashes: string[] = [];
  const uploadedFiles: string[] = [];

  function withAuth(token: string) {
    return {
      get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
      post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
      put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
      patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
      delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
    };
  }
  const prof = () => withAuth(professorToken);
  const alu = () => withAuth(alunoToken);

  async function login(email: string) {
    const res = await request(app).post('/api/auth/login').send({ email, password: '123456' });
    expect(res.status).toBe(200);
    createdHashes.push(hashToken(res.body.refreshToken));
    return res.body;
  }

  beforeAll(async () => {
    const professor = await login('professor@classhub.local');
    professorToken = professor.token;
    const aluno = await login('aluno@classhub.local');
    alunoToken = aluno.token;
    alunoId = aluno.user.id;
  });

  afterAll(async () => {
    if (subjectId) await pool.query('DELETE FROM subjects WHERE id=$1', [subjectId]);
    if (alunoId)
      await pool.query('DELETE FROM notifications WHERE user_id=$1 AND created_at>=$2', [
        alunoId,
        startedAt,
      ]);
    if (createdHashes.length)
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ANY($1)', [createdHashes]);
    for (const f of uploadedFiles) fs.promises.unlink(f).catch(() => {});
    await pool.end();
  });

  it('professor cria disciplina sandbox; aluno não pode (403)', async () => {
    const deny = await alu().post('/api/subjects').send({ name: 'Negado', code: 'NO' });
    expect(deny.status).toBe(403);
    const res = await prof().post('/api/subjects').send({
      name: '[QA] Disciplina de Testes',
      code: 'QA-101',
    });
    expect(res.status).toBe(201);
    subjectId = res.body.id;
    const list = await alu().get('/api/subjects');
    expect(list.body.some((s: any) => s.id === subjectId)).toBe(true);
  });

  it('bloco de notas salva e recupera por usuário', async () => {
    const put = await alu().put(`/api/notes/${subjectId}`).send({ content: 'nota de teste' });
    expect(put.status).toBe(200);
    expect(put.body.content).toBe('nota de teste');
    const get = await alu().get(`/api/notes/${subjectId}`);
    expect(get.body.content).toBe('nota de teste');
    const other = await prof().get(`/api/notes/${subjectId}`);
    expect(other.body.content ?? '').not.toBe('nota de teste');
  });

  it('agenda: professor cria evento para a turma (ALL)', async () => {
    const res = await prof().post('/api/events').send({
      subjectId,
      title: '[QA] Prova de Qualidade',
      eventDate: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      type: 'PROVA',
      visibility: 'ALL',
    });
    expect(res.status).toBe(201);
    expect(res.body.visibility).toBe('ALL');
    const list = await alu().get('/api/events');
    expect(list.body.some((e: any) => e.title === '[QA] Prova de Qualidade')).toBe(true);
  });

  it('agenda: SELECTED exige destinatários (400)', async () => {
    const res = await prof().post('/api/events').send({
      subjectId,
      title: '[QA] Evento sem destinatários',
      eventDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      visibility: 'SELECTED',
    });
    expect(res.status).toBe(400);
  });

  it('agenda: evento do aluno é forçado PRIVATE e invisível ao professor', async () => {
    const res = await alu().post('/api/events').send({
      subjectId,
      title: '[QA] Revisão pessoal do aluno',
      eventDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      visibility: 'ALL',
    });
    expect(res.status).toBe(201);
    expect(res.body.visibility).toBe('PRIVATE');
    const profList = await prof().get('/api/events');
    expect(profList.body.some((e: any) => e.title === '[QA] Revisão pessoal do aluno')).toBe(false);
    const alunoList = await alu().get('/api/events');
    expect(alunoList.body.some((e: any) => e.title === '[QA] Revisão pessoal do aluno')).toBe(true);
  });

  it('materiais: publicar EXERCICIO com data gera evento automático na agenda', async () => {
    const dueDate = new Date(Date.now() + 96 * 3600 * 1000).toISOString();
    const res = await prof().post('/api/materials').send({
      subjectId,
      title: '[QA] Lista de exercícios',
      description: 'Exercícios de qualidade',
      type: 'EXERCICIO',
      tags: 'teste, qualidade',
      dueDate,
    });
    expect(res.status).toBe(201);
    materialId = res.body.id;
    const events = await prof().get('/api/events');
    const auto = events.body.find((e: any) => e.source_material_id === materialId);
    expect(auto).toBeTruthy();
    expect(auto.type).toBe('TRABALHO');
  });

  it('materiais: listagem filtra por disciplina e mostra conclusão do aluno', async () => {
    const list = await alu().get(`/api/materials?subjectId=${subjectId}`);
    expect(list.status).toBe(200);
    expect(list.body.some((m: any) => m.id === materialId)).toBe(true);
    expect(list.body.every((m: any) => m.subject_id === subjectId)).toBe(true);
  });

  it('materiais: nova versão de arquivo e histórico de versões', async () => {
    const v = await prof()
      .post(`/api/materials/${materialId}/version`)
      .attach('file', Buffer.from('conteudo v2'), 'lista-v2.pdf');
    expect(v.status).toBe(201);
    expect(v.body.version).toBe(2);
    uploadedFiles.push(v.body.file_path);
    const versions = await alu().get(`/api/materials/${materialId}/versions`);
    expect(versions.body.length).toBe(1);
    expect(versions.body[0].version).toBe(2);
    const missing = await prof()
      .post('/api/materials/00000000-0000-0000-0000-000000000000/version')
      .attach('file', Buffer.from('x'), 'x.pdf');
    expect(missing.status).toBe(404);
  });

  it('progresso: aluno conclui material e o progresso da disciplina vai a 100%', async () => {
    const mark = await alu().patch(`/api/materials/${materialId}/progress`).send({ completed: true });
    expect(mark.status).toBe(200);
    expect(mark.body.completed).toBe(true);
    const progress = await alu().get('/api/progress');
    const entry = progress.body.find((p: any) => p.id === subjectId);
    expect(entry).toBeTruthy();
    expect(entry.total).toBe(1);
    expect(entry.completed).toBe(1);
    expect(entry.progress).toBe(100);
  });

  it('avisos: professor publica aviso fixado; listagem respeita fixados', async () => {
    const res = await prof().post('/api/notices').send({
      subjectId,
      title: '[QA] Aviso fixado',
      content: 'Conteúdo do aviso',
      pinned: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.pinned).toBe(true);
    noticeId = res.body.id;
    const list = await alu().get('/api/notices');
    const found = list.body.find((n: any) => n.id === noticeId);
    expect(found).toBeTruthy();
    expect(list.body[0].id).toBe(noticeId);
  });

  it('fórum: aluno pergunta; resposta do professor ganha selo oficial', async () => {
    const q = await alu().post('/api/forum').send({
      materialId,
      question: '[QA] Como testar isso?',
    });
    expect(q.status).toBe(201);
    questionId = q.body.id;
    const reply = await prof().post(`/api/forum/${questionId}/replies`).send({
      content: '[QA] Use o fluxo de testes.',
    });
    expect(reply.status).toBe(201);
    expect(reply.body.official).toBe(true);
    const list = await alu().get('/api/forum');
    const found = list.body.find((x: any) => x.id === questionId);
    expect(found.answered).toBe(true);
    expect(found.replies.length).toBe(1);
    expect(found.replies[0].official).toBe(true);
  });

  it('salas: aluno cria sala de estudo e publica mensagem', async () => {
    const room = await alu().post('/api/rooms').send({
      subjectId,
      name: '[QA] Sala de revisão',
      description: 'Sala para revisar',
    });
    expect(room.status).toBe(201);
    roomId = room.body.id;
    const post = await alu().post(`/api/rooms/${roomId}/posts`).send({
      content: '[QA] Vamos revisar!',
      link: 'https://exemplo.com',
    });
    expect(post.status).toBe(201);
    const posts = await alu().get(`/api/rooms/${roomId}/posts`);
    expect(posts.body.length).toBe(1);
    expect(posts.body[0].content).toBe('[QA] Vamos revisar!');
  });

  it('trabalhos: professor cria trabalho', async () => {
    const res = await prof().post('/api/assignments').send({
      subjectId,
      title: '[QA] Trabalho de Qualidade',
      description: 'Entregue os testes',
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });
    expect(res.status).toBe(201);
    assignmentId = res.body.id;
    const list = await alu().get('/api/assignments');
    const found = list.body.find((a: any) => a.id === assignmentId);
    expect(found).toBeTruthy();
    expect(found.submission_count).toBe(0);
  });

  it('trabalhos: aluno entrega arquivo .pdf; reenvio substitui', async () => {
    const submit = await alu()
      .post(`/api/assignments/${assignmentId}/submit`)
      .attach('file', Buffer.from('conteudo do trabalho'), 'trabalho.pdf');
    expect(submit.status).toBe(201);
    uploadedFiles.push(submit.body.file_path);
    const resubmit = await alu()
      .post(`/api/assignments/${assignmentId}/submit`)
      .attach('file', Buffer.from('conteudo v2'), 'trabalho-v2.pdf');
    expect(resubmit.status).toBe(201);
    uploadedFiles.push(resubmit.body.file_path);
    const subs = await prof().get(`/api/assignments/${assignmentId}/submissions`);
    expect(subs.body.length).toBe(1);
    expect(subs.body[0].file_name).toBe('trabalho-v2.pdf');
    submissionId = subs.body[0].id;
  });

  it('trabalhos: rejeita arquivo vazio (400)', async () => {
    const res = await alu()
      .post(`/api/assignments/${assignmentId}/submit`)
      .attach('file', Buffer.alloc(0), 'vazio.pdf');
    expect(res.status).toBe(400);
  });

  it('trabalhos: professor corrige com nota e feedback', async () => {
    const res = await prof().patch(`/api/assignments/submissions/${submissionId}`).send({
      score: 8.5,
      feedback: 'Bom trabalho',
    });
    expect(res.status).toBe(200);
    expect(Number(res.body.score)).toBe(8.5);
  });

  it('boletim: aluno vê nota e status GRADED; professor vê visão da turma', async () => {
    const boletim = await alu().get('/api/grades');
    expect(boletim.body.role).toBe('ALUNO');
    const subject = boletim.body.subjects.find((s: any) => s.id === subjectId);
    expect(subject).toBeTruthy();
    expect(subject.avg).toBe(8.5);
    const assignment = subject.assignments.find((a: any) => a.id === assignmentId);
    expect(assignment.status).toBe('GRADED');
    expect(assignment.score).toBe(8.5);
    const profView = await prof().get('/api/grades');
    expect(profView.body.role).toBe('PROFESSOR');
    expect(profView.body.students.length).toBeGreaterThan(0);
  });

  it('notificações: fluxo gerou notificações; leitura e exclusão funcionam', async () => {
    const list = await alu().get('/api/notifications');
    const fresh = list.body.filter((n: any) => new Date(n.created_at) >= startedAt);
    expect(fresh.length).toBeGreaterThan(0);
    const grade = fresh.find((n: any) => n.type === 'GRADE');
    expect(grade).toBeTruthy();
    const read = await alu().patch(`/api/notifications/${grade.id}/read`);
    expect(read.status).toBe(200);
    expect(read.body.read_at).toBeTruthy();
    const readAll = await alu().patch('/api/notifications/read-all');
    expect(readAll.body.ok).toBe(true);
    const del = await alu().delete(`/api/notifications/${grade.id}`);
    expect(del.body.ok).toBe(true);
    const missing = await alu().patch(`/api/notifications/${grade.id}/read`);
    expect(missing.status).toBe(404);
    const vapid = await alu().get('/api/notifications/vapid-public');
    expect(vapid.status).toBe(200);
  });

  it('estatísticas: contadores do dashboard respondem', async () => {
    const res = await alu().get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.subjects).toBeGreaterThanOrEqual(1);
    expect(res.body.materials).toBeGreaterThanOrEqual(1);
    expect(res.body.upcomingEvents).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.unreadNotifications).toBe('number');
  });

  it('chat: histórico da disciplina responde (sem mensagens no fluxo HTTP)', async () => {
    const res = await alu().get(`/api/chat/${subjectId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('ABNT: salva, lista e exclui referência', async () => {
    const create = await alu().post('/api/abnt/references').send({
      type: 'BOOK',
      data: { autor: 'Silva, João', titulo: 'Qualidade de Software' },
      formatted: 'SILVA, João. Qualidade de Software. São Paulo: Editora, 2020.',
      subjectId,
    });
    expect(create.status).toBe(201);
    refId = create.body.id;
    const invalid = await alu().post('/api/abnt/references').send({ type: 'BOOK' });
    expect(invalid.status).toBe(400);
    const list = await alu().get('/api/abnt/references');
    expect(list.body.some((r: any) => r.id === refId)).toBe(true);
    const del = await alu().delete(`/api/abnt/references/${refId}`);
    expect(del.body.ok).toBe(true);
    refId = '';
  });

  it('busca global encontra itens do sandbox e respeita visibilidade', async () => {
    const res = await alu().get('/api/search?q=' + encodeURIComponent('[QA]'));
    expect(res.status).toBe(200);
    expect(res.body.materials.some((m: any) => m.id === materialId)).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.notices.some((n: any) => n.id === noticeId)).toBe(true);
    expect(res.body.forum.some((f: any) => f.id === questionId)).toBe(true);
    const professorView = await prof().get('/api/search?q=' + encodeURIComponent('Revisão pessoal'));
    expect(professorView.body.events.length).toBe(0);
    const short = await alu().get('/api/search?q=a');
    expect(short.body).toEqual({ materials: [], events: [], forum: [], notices: [] });
  });

  it('CSV: exporta boletim (professor); aluno é bloqueado', async () => {
    const denied = await alu().get('/api/grades/export');
    expect(denied.status).toBe(403);
    const boletim = await prof().get('/api/grades/export');
    expect(boletim.status).toBe(200);
    expect(boletim.text).toContain('Aluno;Email;Disciplina;Entregas;Corrigidas');
  });

  it('exclusões: professor remove trabalho e material', async () => {
    const delAssignment = await prof().delete(`/api/assignments/${assignmentId}`);
    expect(delAssignment.status).toBe(204);
    const delMaterial = await prof().delete(`/api/materials/${materialId}`);
    expect(delMaterial.status).toBe(204);
    const events = await prof().get('/api/events');
    expect(events.body.some((e: any) => e.source_assignment_id === assignmentId)).toBe(false);
  });
});
