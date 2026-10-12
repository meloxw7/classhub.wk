import { describe, it, expect, vi } from 'vitest';
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { auth, role, AuthRequest } from './auth';
import { getJwtSecret } from '../lib/env';

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return res as unknown as Response & { status: any; json: any };
}

function makeReq(headers: Record<string, string> = {}) {
  return { headers } as unknown as AuthRequest;
}

function sign(payload: object) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '1h' });
}

const user = { id: 'u1', name: 'Aluno', email: 'a@x.com', role: 'ALUNO' as const };

describe('middleware auth', () => {
  it('recusa requisição sem token (401)', () => {
    const req = makeReq();
    const res = makeRes();
    auth(req, res, (() => {}) as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Não autenticado' });
  });

  it('recusa token inválido (401 "Sessão expirada")', () => {
    const req = makeReq({ authorization: 'Bearer token-invalido' });
    const res = makeRes();
    auth(req, res, (() => {}) as NextFunction);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Sessão expirada' });
  });

  it('popula req.user com token válido e chama next', () => {
    const req = makeReq({ authorization: `Bearer ${sign(user)}` });
    const res = makeRes();
    const next = vi.fn();
    auth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1', email: 'a@x.com', role: 'ALUNO' });
  });

  it('guard de role nega perfil não autorizado (403)', () => {
    const req = { ...makeReq(), user };
    const res = makeRes();
    role('PROFESSOR')(req as AuthRequest, res, (() => {}) as NextFunction);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Acesso negado' });
  });

  it('guard de role libera perfil autorizado', () => {
    const professor = { ...user, role: 'PROFESSOR' as const };
    const req = { ...makeReq(), user: professor };
    const res = makeRes();
    const next = vi.fn();
    role('PROFESSOR', 'ALUNO')(req as AuthRequest, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
