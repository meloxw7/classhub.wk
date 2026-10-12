import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import app from './app';
import { pool } from './lib/db';
import { hashToken, generateToken } from './lib/tokens';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('extras de autenticação, perfil e ABNT (banco real)', () => {
  const startedAt = new Date();
  const alunoEmail = 'aluno@classhub.local';
  let alunoId = '';
  let alunoToken = '';
  let originalHash = '';
  let originalName = '';
  const createdHashes: string[] = [];
  const createdFiles: string[] = [];
  const createdEndpoints: string[] = [];

  const alu = () => ({
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${alunoToken}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${alunoToken}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${alunoToken}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${alunoToken}`),
  });

  async function login(email: string, password: string) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    if (res.status === 200) createdHashes.push(hashToken(res.body.refreshToken));
    return res;
  }

  beforeAll(async () => {
    const res = await login(alunoEmail, '123456');
    expect(res.status).toBe(200);
    alunoToken = res.body.token;
    alunoId = res.body.user.id;
    const u = await pool.query('SELECT name,password_hash FROM users WHERE id=$1', [alunoId]);
    originalName = u.rows[0].name;
    originalHash = u.rows[0].password_hash;
  });

  afterAll(async () => {
    if (alunoId) {
      await pool.query('UPDATE users SET password_hash=$1,name=$2,avatar_path=NULL WHERE id=$3', [
        originalHash,
        originalName,
        alunoId,
      ]);
      await pool.query('DELETE FROM notifications WHERE user_id=$1 AND created_at>=$2', [
        alunoId,
        startedAt,
      ]);
      await pool.query('DELETE FROM password_resets WHERE user_id=$1', [alunoId]);
      await pool.query("DELETE FROM abnt_references WHERE user_id=$1", [alunoId]);
    }
    if (createdHashes.length)
      await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ANY($1)', [createdHashes]);
    if (createdEndpoints.length)
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ANY($1)', [
        createdEndpoints,
      ]);
    for (const f of createdFiles) fs.promises.unlink(f).catch(() => {});
    await pool.end();
  });

  it('refresh rotaciona o token: reuso do antigo é recusado', async () => {
    const login1 = await login(alunoEmail, '123456');
    const first = login1.body.refreshToken;
    const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(refresh.status).toBe(200);
    expect(refresh.body.token).toBeTruthy();
    createdHashes.push(hashToken(refresh.body.refreshToken));
    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);
    const noToken = await request(app).post('/api/auth/refresh').send({});
    expect(noToken.status).toBe(401);
  });

  it('logout revoga o refreshToken informado', async () => {
    const session = await login(alunoEmail, '123456');
    const token = session.body.refreshToken;
    const logout = await request(app).post('/api/auth/logout').send({ refreshToken: token });
    expect(logout.body.ok).toBe(true);
    const after = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    expect(after.status).toBe(401);
    const anon = await request(app).post('/api/auth/logout').send({});
    expect(anon.body.ok).toBe(true);
  });

  it('forgot sempre responde ok (não revela existência do e-mail)', async () => {
    const unknown = await request(app)
      .post('/api/auth/forgot')
      .send({ email: 'ninguem@classhub.local' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.ok).toBe(true);
    const known = await request(app).post('/api/auth/forgot').send({ email: alunoEmail });
    expect(known.status).toBe(200);
    expect(known.body.ok).toBe(true);
  });

  it('reset: valida entradas, aceita token válido e recusa reuso/expirado', async () => {
    const missing = await request(app).post('/api/auth/reset').send({ token: 'x' });
    expect(missing.status).toBe(400);
    const short = await request(app)
      .post('/api/auth/reset')
      .send({ token: 'x', newPassword: '123' });
    expect(short.status).toBe(400);
    const invalid = await request(app)
      .post('/api/auth/reset')
      .send({ token: generateToken(), newPassword: 'novasenha' });
    expect(invalid.status).toBe(400);

    const token = generateToken();
    await pool.query(
      "INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",
      [alunoId, hashToken(token)]
    );
    const reset = await request(app)
      .post('/api/auth/reset')
      .send({ token, newPassword: 'senhanova123' });
    expect(reset.body.ok).toBe(true);
    const loginNew = await login(alunoEmail, 'senhanova123');
    expect(loginNew.status).toBe(200);
    const reuse = await request(app)
      .post('/api/auth/reset')
      .send({ token, newPassword: 'outrasenha' });
    expect(reuse.status).toBe(400);

    const expired = generateToken();
    await pool.query(
      "INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,$2,NOW()-INTERVAL '2 hours')",
      [alunoId, hashToken(expired)]
    );
    const expiredRes = await request(app)
      .post('/api/auth/reset')
      .send({ token: expired, newPassword: 'senhanova123' });
    expect(expiredRes.status).toBe(400);
  });

  it('reset também revoga sessões ativas criadas antes dele', async () => {
    const pre = await pool.query('SELECT revoked_at FROM refresh_tokens WHERE token_hash=$1', [
      createdHashes[0],
    ]);
    expect(pre.rows[0].revoked_at).not.toBeNull();
  });

  it('perfil: consultando e atualizando nome', async () => {
    const me = await alu().get('/api/users/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(alunoEmail);
    const empty = await alu().put('/api/users/me').send({ name: '  ' });
    expect(empty.status).toBe(400);
    const update = await alu().put('/api/users/me').send({ name: 'Aluno QA Temporário' });
    expect(update.status).toBe(200);
    expect(update.body.name).toBe('Aluno QA Temporário');
    const check = await alu().get('/api/users/me');
    expect(check.body.name).toBe('Aluno QA Temporário');
  });

  it('troca de senha: valida senha atual, tamanho mínimo e novo login', async () => {
    const missing = await alu().put('/api/users/password').send({});
    expect(missing.status).toBe(400);
    const short = await alu()
      .put('/api/users/password')
      .send({ currentPassword: 'senhanova123', newPassword: '123' });
    expect(short.status).toBe(400);
    const wrong = await alu()
      .put('/api/users/password')
      .send({ currentPassword: 'errada', newPassword: 'novasenha' });
    expect(wrong.status).toBe(401);
    const ok = await alu()
      .put('/api/users/password')
      .send({ currentPassword: 'senhanova123', newPassword: 'senhanova456' });
    expect(ok.body.ok).toBe(true);
    const relogin = await login(alunoEmail, 'senhanova456');
    expect(relogin.status).toBe(200);
    alunoToken = relogin.body.token;
  });

  it('avatar: aceita JPG/PNG e recusa outros formatos', async () => {
    const bad = await alu()
      .post('/api/users/me/avatar')
      .attach('avatar', Buffer.from('x'), 'foto.gif');
    expect(bad.status).toBe(400);
    const none = await alu().post('/api/users/me/avatar');
    expect(none.status).toBe(400);
    const good = await alu()
      .post('/api/users/me/avatar')
      .attach('avatar', Buffer.from('conteudo-jpg-falso'), 'foto.jpg');
    expect(good.status).toBe(200);
    expect(good.body.avatar_path).toBeTruthy();
    createdFiles.push(good.body.avatar_path);
  });

  it('push subscribe: valida payload e registra assinatura', async () => {
    const invalid = await alu().post('/api/notifications/subscribe').send({});
    expect(invalid.status).toBe(400);
    const endpoint = 'https://fcm.googleapis.test/qa';
    createdEndpoints.push(endpoint);
    const sub = await alu().post('/api/notifications/subscribe').send({
      endpoint,
      subscription: { endpoint, keys: { p256dh: 'x', auth: 'y' } },
    });
    expect(sub.body.ok).toBe(true);
  });

  it('ABNT convert: extrai texto de .txt com detecção de título', async () => {
    const res = await alu()
      .post('/api/abnt/convert')
      .attach(
        'file',
        Buffer.from('INTRODUÇÃO\n\nEste trabalho trata de qualidade de software.\n\nCONCLUSÃO\n\nFim.'),
        'trabalho.txt'
      );
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('TXT');
    expect(res.body.sections.length).toBe(4);
    expect(res.body.sections[0].level).toBe(1);
    expect(res.body.sections[2].level).toBe(1);
    expect(res.body.sections[3].level).toBe(0);
  });

  it('ABNT convert: recusa arquivo vazio e formato não suportado', async () => {
    const empty = await alu()
      .post('/api/abnt/convert')
      .attach('file', Buffer.alloc(0), 'vazio.txt');
    expect(empty.status).toBe(400);
    const unsupported = await alu()
      .post('/api/abnt/convert')
      .attach('file', Buffer.from('x'), 'arquivo.xyz');
    expect(unsupported.status).toBe(400);
    const noFile = await alu().post('/api/abnt/convert');
    expect(noFile.status).toBe(400);
  });

  it('ABNT export: gera .docx ABNT com capa, sumário e referências', async () => {
    const res = await request(app)
      .post('/api/abnt/export')
      .set('Authorization', `Bearer ${alunoToken}`)
      .parse((res2: any, cb: any) => {
        const chunks: Buffer[] = [];
        res2.on('data', (c: Buffer) => chunks.push(c));
        res2.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({
      cover: {
        institution: 'Instituto QA',
        author: 'Aluno QA Temporário',
        title: 'Trabalho de Qualidade',
        type: 'Trabalho de Conclusão',
        course: 'TADS',
        city: 'Cidade',
        year: '2026',
        advisor: 'Prof. Orientador',
      },
      sections: [
        { level: 1, text: 'INTRODUÇÃO', images: [] },
        { level: 0, text: 'Texto do trabalho formatado em ABNT.', images: [] },
        { level: 2, text: 'Objetivos', images: [] },
      ],
      references: ['SILVA, João. Qualidade de Software. São Paulo: Editora, 2020.'],
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('wordprocessingml.document');
    expect(res.headers['content-disposition']).toContain('trabalho-de-qualidade-abnt.docx');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(5000);
  });
});
