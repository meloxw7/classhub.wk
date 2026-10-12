import { describe, it, expect, afterEach } from 'vitest';
import { getJwtSecret } from './env';

const originalSecret = process.env.JWT_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe('getJwtSecret', () => {
  it('retorna "dev" fora de produção quando JWT_SECRET não está definida', () => {
    delete process.env.JWT_SECRET;
    expect(getJwtSecret()).toBe('dev');
  });

  it('retorna o valor de JWT_SECRET quando definida', () => {
    process.env.JWT_SECRET = 'segredo-de-teste';
    expect(getJwtSecret()).toBe('segredo-de-teste');
  });

  it('lança erro em produção sem JWT_SECRET', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });
});
