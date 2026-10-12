import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('rate limit de /api/auth', () => {
  it('bloqueia após 30 tentativas por minuto (429)', async () => {
    const requests = Array.from({ length: 35 }, () =>
      request(app).post('/api/auth/login').send({})
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    const blocked = statuses.filter((s) => s === 429).length;
    const accepted = statuses.filter((s) => s === 400).length;
    expect(accepted).toBe(30);
    expect(blocked).toBe(5);
  });
});
