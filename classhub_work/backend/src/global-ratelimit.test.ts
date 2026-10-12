import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('rate limit global da /api', () => {
  it('bloqueia requisições acima do limite por minuto (429)', async () => {
    const responses = await Promise.all(
      Array.from({ length: 250 }, () => request(app).get('/api/subjects'))
    );
    const statuses = responses.map((r) => r.status);
    const unauthorized = statuses.filter((s) => s === 401).length;
    const blocked = statuses.filter((s) => s === 429).length;
    expect(unauthorized).toBe(240);
    expect(blocked).toBe(10);
  });

  it('health check fica fora do rate limit', async () => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, () => request(app).get('/api/health'))
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});
