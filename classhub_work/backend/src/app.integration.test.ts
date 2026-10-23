import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from './app';
import { pool } from './lib/db';
import { hashToken } from './lib/tokens';

const hasDb = Boolean(process.env.DATABASE_URL);
const createdHashes: string[] = [];
let alunoToken = '';

afterAll(async () => {
  if (hasDb) {
    await pool.query("DELETE FROM subjects WHERE name LIKE '[QA-REG]%'");
    await pool.query("DELETE FROM users WHERE email LIKE 'qareg-%@classhub.test'");
    if (createdHashes.length) {
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ANY($1)', [createdHashes]);
    }
  }
  await pool.end();
});

describe('GET /api/health', () => {
  it('responde ok sem autenticação', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: 'ClassHub API' });
  });
});

describe.skipIf(!hasDb)('fluxo de autenticação (banco real)', () => {
  const aluno = { email: 'aluno@classhub.local', password: '123456' };
  const professor = { email: 'professor@classhub.local', password: '123456' };

  it('recusa login sem e-mail/senha (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/obrigató/i);
  });

  it('recusa credenciais inválidas (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: aluno.email, password: 'senha-errada' });
    expect(res.status).toBe(401);
  });

  it('autentica o aluno demo e devolve sessão', async () => {
    const res = await request(app).post('/api/auth/login').send(aluno);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.user).toMatchObject({ email: aluno.email, role: 'ALUNO' });
    alunoToken = res.body.token;
    createdHashes.push(hashToken(res.body.refreshToken));
  });

  it('autentica o professor demo', async () => {
    const res = await request(app).post('/api/auth/login').send(professor);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: professor.email, role: 'PROFESSOR' });
    createdHashes.push(hashToken(res.body.refreshToken));
  });

  it('exige token em rotas privadas (401)', async () => {
    const res = await request(app).get('/api/subjects');
    expect(res.status).toBe(401);
  });

  it('lista disciplinas com token válido (200)', async () => {
    const login = await request(app).post('/api/auth/login').send(aluno);
    createdHashes.push(hashToken(login.body.refreshToken));
    const res = await request(app)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('nega rota de professor ao aluno (403)', async () => {
    const login = await request(app).post('/api/auth/login').send(aluno);
    createdHashes.push(hashToken(login.body.refreshToken));
    const res = await request(app)
      .get('/api/users/students')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(403);
  });

  it('libera rota de professor ao professor (200)', async () => {
    const login = await request(app).post('/api/auth/login').send(professor);
    createdHashes.push(hashToken(login.body.refreshToken));
    const res = await request(app)
      .get('/api/users/students')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('cadastra aluno com dados do formulário e entra automaticamente', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'QA Registro Aluno',
      email: 'qareg-aluno@classhub.test',
      password: 'senha123',
      role: 'ALUNO',
      course: 'Análise e Desenvolvimento de Sistemas',
      semester: '26.2',
      ra: 'RA12345',
      institution: 'Universidade Federal de Pernambuco (UFPE)',
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.user).toMatchObject({
      email: 'qareg-aluno@classhub.test',
      role: 'ALUNO',
      course: 'Análise e Desenvolvimento de Sistemas',
      semester: '26.2',
      ra: 'RA12345',
      institution: 'Universidade Federal de Pernambuco (UFPE)',
    });
    createdHashes.push(hashToken(res.body.refreshToken));
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'qareg-aluno@classhub.test', password: 'senha123', rememberMe: true });
    expect(login.status).toBe(200);
    expect(login.body.user.course).toBe('Análise e Desenvolvimento de Sistemas');
    createdHashes.push(hashToken(login.body.refreshToken));
  });

  it('recusa cadastro com e-mail duplicado (409)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'QA Duplicado',
      email: 'qareg-aluno@classhub.test',
      password: 'senha123',
      role: 'ALUNO',
    });
    expect(res.status).toBe(409);
  });

  it('recusa cadastro com e-mail inválido ou senha curta (400)', async () => {
    const badEmail = await request(app).post('/api/auth/register').send({
      name: 'QA Email Ruim',
      email: 'nao-e-email',
      password: 'senha123',
      role: 'ALUNO',
    });
    expect(badEmail.status).toBe(400);
    const shortPassword = await request(app).post('/api/auth/register').send({
      name: 'QA Senha Curta',
      email: 'qareg-curta@classhub.test',
      password: '123',
      role: 'ALUNO',
    });
    expect(shortPassword.status).toBe(400);
  });

  it('exige código da instituição e disciplina no cadastro de professor', async () => {
    const noCode = await request(app).post('/api/auth/register').send({
      name: 'QA Prof Sem Código',
      email: 'qareg-prof1@classhub.test',
      password: 'senha123',
      role: 'PROFESSOR',
      subjectName: '[QA-REG] Banco de Dados',
    });
    expect(noCode.status).toBe(400);
    const wrongCode = await request(app).post('/api/auth/register').send({
      name: 'QA Prof Código Errado',
      email: 'qareg-prof2@classhub.test',
      password: 'senha123',
      role: 'PROFESSOR',
      institutionCode: 'ERRADO',
      subjectName: '[QA-REG] Banco de Dados',
    });
    expect(wrongCode.status).toBe(403);
    const noSubject = await request(app).post('/api/auth/register').send({
      name: 'QA Prof Sem Disciplina',
      email: 'qareg-prof3@classhub.test',
      password: 'senha123',
      role: 'PROFESSOR',
      institutionCode: 'NASSAU14',
    });
    expect(noSubject.status).toBe(400);
  });

  it('cadastra professor com código NASSAU14 e cria a disciplina lecionada', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'QA Registro Professor',
      email: 'qareg-prof-ok@classhub.test',
      password: 'senha123',
      role: 'PROFESSOR',
      institutionCode: 'NASSAU14',
      subjectName: '[QA-REG] Engenharia de Software',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      role: 'PROFESSOR',
      institution: 'Uninassau Boa Viagem',
    });
    createdHashes.push(hashToken(res.body.refreshToken));
    const subjects = await request(app)
      .get('/api/subjects')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(
      subjects.body.some((s: any) => s.name === '[QA-REG] Engenharia de Software')
    ).toBe(true);
  });

  it('identifica a instituição automaticamente pelos códigos cadastrados', async () => {
    const cases = [
      ['CZC14', 'Colégio Zuleide Constantino', '[QA-REG] Matemática'],
      ['csl', 'Colégio Souza Leão', '[QA-REG] Português'],
      ['UNB14', 'Unibra Faculdade', '[QA-REG] Direito'],
    ];
    for (const [code, institution, subject] of cases) {
      const res = await request(app).post('/api/auth/register').send({
        name: 'QA Prof Instituição',
        email: `qareg-inst-${String(code).toLowerCase()}@classhub.test`,
        password: 'senha123',
        role: 'PROFESSOR',
        institutionCode: code,
        subjectName: subject,
      });
      expect(res.status).toBe(201);
      expect(res.body.user.institution).toBe(institution);
      createdHashes.push(hashToken(res.body.refreshToken));
    }
  });
});

describe('documentação Swagger', () => {
  it('serve a UI em /api/docs', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger/i);
  });

  it('serve o spec OpenAPI em /api/docs/openapi.json', async () => {
    const res = await request(app).get('/api/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths)).toContain('/api/health');
    expect(Object.keys(res.body.paths)).toContain('/api/tutor/chat');
  });
});

describe.skipIf(!hasDb)('tutor IA', () => {
  it('exige autenticação (401)', async () => {
    const res = await request(app).post('/api/tutor/chat').send({ messages: [] });
    expect(res.status).toBe(401);
  });

  it('recusa payload inválido (400)', async () => {
    const res = await request(app)
      .post('/api/tutor/chat')
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({ messages: [{ role: 'model', content: 'oi' }] });
    expect(res.status).toBe(400);
  });

  it('transmite chunks do provedor em streaming (fetch mockado)', async () => {
    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":"Olá"}]}}]}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"candidates":[{"content":{"parts":[{"text":", tudo bem?"}]}}]}\n\n'
          )
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: sse }))
    );
    const res = await request(app)
      .post('/api/tutor/chat')
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({ messages: [{ role: 'user', content: 'oi' }] });
    vi.unstubAllGlobals();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('"text":"Olá"');
    expect(res.text).toContain('"text":", tudo bem?"');
    expect(res.text).toContain('[DONE]');
  });

  it('aceita anexo multipart e o envia ao provedor', async () => {
    const encoder = new TextEncoder();
    const sse = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"candidates":[{"content":{"parts":[{"text":"Li o anexo."}]}}]}\n\n')
        );
        controller.close();
      },
    });
    let upstreamBody = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: any) => {
        upstreamBody = init.body;
        return { ok: true, body: sse };
      })
    );
    const res = await request(app)
      .post('/api/tutor/chat')
      .set('Authorization', `Bearer ${alunoToken}`)
      .field('data', JSON.stringify({ messages: [{ role: 'user', content: 'analise' }] }))
      .attach('files', Buffer.from('conteúdo da nota de estudo'), {
        filename: 'nota.txt',
        contentType: 'text/plain',
      });
    vi.unstubAllGlobals();
    expect(res.status).toBe(200);
    expect(res.text).toContain('"text":"Li o anexo."');
    expect(upstreamBody).toContain('nota.txt');
    expect(upstreamBody).toContain('conteúdo da nota de estudo');
  });

  it('gera um PDF real (arquivo baixável) de uma resposta', async () => {
    const res = await request(app)
      .post('/api/tutor/pdf')
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({
        title: 'Plano de estudos',
        content:
          '# Plano de estudos\n\nFoco em **Banco de Dados**.\n\n- Revisar normalização\n- Praticar `JOIN`\n\n1. Segunda: leitura\n2. Terça: exercícios\n\n```sql\nSELECT * FROM users;\n```\n',
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('lumi-resposta.pdf');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('recusa PDF sem conteúdo (400)', async () => {
    const res = await request(app)
      .post('/api/tutor/pdf')
      .set('Authorization', `Bearer ${alunoToken}`)
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });
});
