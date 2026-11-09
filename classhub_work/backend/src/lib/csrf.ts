import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'Token CSRF inválido' });
  }

  next();
}

export function setCsrfCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function ensureCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    setCsrfCookie(res, token);
  }
  next();
}

export function getCsrfToken(req: Request): string | undefined {
  return req.cookies?.[CSRF_COOKIE_NAME];
}