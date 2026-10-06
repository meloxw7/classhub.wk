import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/env';
export type AuthUser = { id: string; name: string; email: string; role: 'PROFESSOR' | 'ALUNO' };
export type AuthRequest = Request & { user?: AuthUser };
export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, getJwtSecret()) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ message: 'Sessão expirada' });
  }
}
export const role =
  (...roles: AuthUser['role'][]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ message: 'Acesso negado' });
    next();
  };
