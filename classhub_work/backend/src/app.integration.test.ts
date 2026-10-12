import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from './app';
import { pool } from './lib/db';
import { hashToken } from './lib/tokens';

const hasDb = Boolean(process.env.DATABASE_URL);
const createdHashes: string[] = [];

afterAll(async () => {
  if (hasDb && createdHashes.length) {
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = ANY($1)', [createdHashes]);
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
  });
});
