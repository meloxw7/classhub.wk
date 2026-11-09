import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/db';
import { getJwtSecret } from '../lib/env';
import { generateToken, hashToken } from '../lib/tokens';
import { sendMail } from '../lib/mailer';
import { ensureUsernameSchema, uniqueUsername, USERNAME_RE } from '../lib/username';
import { ensureAdminSchema } from '../lib/admin';

const router = Router();

const INSTITUTIONS: Record<string, string> = {
  NASSAU14: 'Uninassau Boa Viagem',
  CZC14: 'Colégio Zuleide Constantino',
  CSL: 'Colégio Souza Leão',
  UNB14: 'Unibra Faculdade',
};
for (const pair of String(process.env.INSTITUTION_CODES || '').split(';').filter(Boolean)) {
  const parts = pair.split(':');
  if (parts.length >= 2)
    INSTITUTIONS[parts[0].trim().toUpperCase()] = parts.slice(1).join(':').trim();
}

const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  maxAge: maxAgeMs,
  path: '/',
});

function setAuthCookies(res: Response, token: string, refreshToken: string, remember: boolean) {
  res.cookie('access_token', token, cookieOpts(2 * 60 * 60 * 1000));
  res.cookie('refresh_token', refreshToken, cookieOpts(remember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { ...cookieOpts(0), maxAge: 0 });
  res.clearCookie('refresh_token', { ...cookieOpts(0), maxAge: 0 });
}

async function issueSession(
  user: { id: string; name: string; email: string; role: string },
  remember = false
) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '2h' }
  );
  const refreshToken = generateToken();
  const ttl = remember ? '30 days' : '1 day';
  await pool.query(
    `INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES($1, $2, NOW() + INTERVAL '${ttl}')`,
    [user.id, hashToken(refreshToken)]
  );
  return { token, refreshToken };
}

async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await pool.query(
    'INSERT INTO login_attempts(email, ip, success) VALUES($1, $2, $3)',
    [email.toLowerCase().trim(), ip, success]
  );
}

async function isLockedOut(email: string, ip: string): Promise<{ locked: boolean; retryAfter?: number }> {
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const r = await pool.query(
    `SELECT COUNT(*) FROM login_attempts
     WHERE email = $1 AND ip = $2 AND success = false
     AND created_at > NOW() - INTERVAL '${windowMs} milliseconds'`,
    [email.toLowerCase().trim(), ip]
  );
  const count = parseInt(r.rows[0].count, 10);
  if (count >= maxAttempts) {
    const oldest = await pool.query(
      `SELECT created_at FROM login_attempts
       WHERE email = $1 AND ip = $2 AND success = false
       ORDER BY created_at ASC LIMIT 1`,
      [email.toLowerCase().trim(), ip]
    );
    if (oldest.rowCount) {
      const retryAfter = Math.ceil((new Date(oldest.rows[0].created_at).getTime() + windowMs - Date.now()) / 1000);
      return { locked: true, retryAfter: Math.max(1, retryAfter) };
    }
  }
  return { locked: false };
}

async function auditLog(userId: string | null, action: string, metadata: object, ip: string, userAgent: string | undefined) {
  await pool.query(
    'INSERT INTO audit_logs(user_id, action, metadata, ip, user_agent) VALUES($1, $2, $3, $4, $5)',
    [userId, action, JSON.stringify(metadata), ip, userAgent || null]
  );
}

router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios' });
  
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'];
  const normalizedEmail = String(email).toLowerCase().trim();

  const lock = await isLockedOut(normalizedEmail, ip);
  if (lock.locked) {
    await recordLoginAttempt(normalizedEmail, ip, false);
    return res.status(429).json({ 
      message: 'Muitas tentativas de login. Tente novamente mais tarde.',
      retryAfter: lock.retryAfter 
    });
  }

  await ensureAdminSchema().catch(() => {});
  const r = await pool.query(
    'SELECT id,name,username,email,password_hash,role,course,semester,ra,institution,is_admin FROM users WHERE email=$1',
    [normalizedEmail]
  );
  
  if (!r.rowCount || !(await bcrypt.compare(password, r.rows[0].password_hash))) {
    await recordLoginAttempt(normalizedEmail, ip, false);
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }
  
  const u = r.rows[0];
  await recordLoginAttempt(normalizedEmail, ip, true);
  await auditLog(u.id, 'LOGIN', { rememberMe: !!rememberMe }, ip, userAgent);
  
  const session = await issueSession(u, !!rememberMe);
  const { password_hash: _hash, ...user } = u;
  setAuthCookies(res, session.token, session.refreshToken, !!rememberMe);
  res.json({ user });
});

router.post('/register', async (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '')
    .toLowerCase()
    .trim();
  const password = String(body.password || '');
  const role = String(body.role || '').toUpperCase();
  const course = body.course ? String(body.course).trim() : null;
  const semester = body.semester ? String(body.semester).trim() : null;
  const ra = body.ra ? String(body.ra).trim() : null;
  const subjectName = body.subjectName ? String(body.subjectName).trim() : '';
  const requestedUsername = body.username
    ? String(body.username).toLowerCase().trim()
    : '';

  if (!name || name.length < 2) return res.status(400).json({ message: 'Informe seu nome completo' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'E-mail inválido' });
  if (password.length < 6)
    return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres' });
  if (role !== 'ALUNO' && role !== 'PROFESSOR')
    return res.status(400).json({ message: 'Escolha o perfil (aluno ou professor)' });
  if (requestedUsername && !USERNAME_RE.test(requestedUsername))
    return res.status(400).json({
      message: 'Usuário (@): 3 a 20 caracteres, apenas letras minúsculas, números e _',
    });

  let institution: string | null = null;
  if (role === 'PROFESSOR') {
    const institutionCode = String(body.institutionCode || '').trim();
    if (!institutionCode)
      return res
        .status(400)
        .json({ message: 'Professores precisam informar o código da instituição' });
    institution = INSTITUTIONS[institutionCode.toUpperCase()];
    if (!institution) return res.status(403).json({ message: 'Código de instituição inválido' });
    if (!subjectName)
      return res.status(400).json({ message: 'Informe o nome da disciplina que você leciona' });
  } else if (body.institution) {
    institution = String(body.institution).trim().slice(0, 120) || null;
  }

  await ensureUsernameSchema();
  const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email]);
  if (exists.rowCount) return res.status(409).json({ message: 'Este e-mail já está cadastrado' });
  if (requestedUsername) {
    const taken = await pool.query('SELECT 1 FROM users WHERE username=$1', [requestedUsername]);
    if (taken.rowCount) return res.status(409).json({ message: 'Este @usuário já está em uso' });
  }
  const username = requestedUsername || (await uniqueUsername(name));

  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  let u: any;
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO users(name,email,password_hash,role,course,semester,ra,institution,username)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,name,email,role,course,semester,ra,institution,username`,
      [name, email, hash, role, course, semester, ra, institution, username]
    );
    u = r.rows[0];
    if (role === 'PROFESSOR') {
      await client.query('INSERT INTO subjects(name,professor_id) VALUES($1,$2)', [
        subjectName,
        u.id,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    throw error;
  }
  client.release();

  const session = await issueSession(u, true);
  setAuthCookies(res, session.token, session.refreshToken, true);
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'];
  await auditLog(u.id, 'REGISTER', { role: u.role }, ip, userAgent);
  res.status(201).json({ user: u });
});

router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) return res.status(401).json({ message: 'Sessão expirada' });
  const r = await pool.query(
    `SELECT rt.id AS rt_id, u.id, u.name, u.email, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
    [hashToken(String(refreshToken))]
  );
  if (!r.rowCount) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Sessão expirada' });
  }
  const u = r.rows[0];
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [u.rt_id]);
  const session = await issueSession(u);
  setAuthCookies(res, session.token, session.refreshToken, false);
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken)
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [
      hashToken(String(refreshToken)),
    ]);
  const userId = (req as any).user?.id;
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'];
  if (userId) await auditLog(userId, 'LOGOUT', {}, ip, userAgent);
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'];
  if (email) {
    const r = await pool.query('SELECT id, name FROM users WHERE email = $1', [String(email)]);
    if (r.rowCount) {
      const token = generateToken();
      await pool.query(
        "INSERT INTO password_resets(user_id, token_hash, expires_at) VALUES($1, $2, NOW() + INTERVAL '1 hour')",
        [r.rows[0].id, hashToken(token)]
      );
      await auditLog(r.rows[0].id, 'PASSWORD_RESET_REQUEST', {}, ip, userAgent);
      const base = process.env.CLIENT_URL || 'http://localhost:5173';
      const link = `${base}/resetar-senha?token=${encodeURIComponent(token)}`;
      try {
        await sendMail(
          String(email),
          'ClassHub — Recuperação de senha',
          `<p>Olá, ${r.rows[0].name}.</p>
           <p>Recebemos uma solicitação para redefinir sua senha. O link abaixo expira em 1 hora:</p>
           <p><a href="${link}">Redefinir minha senha</a></p>
           <p>Se não foi você quem solicitou, ignore este e-mail.</p>`
        );
      } catch (error) {
        console.error('Falha ao enviar e-mail de recuperação:', error);
      }
    }
  }
  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  const { token, newPassword } = req.body || {};
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'];
  if (!token || !newPassword)
    return res.status(400).json({ message: 'Informe o token e a nova senha' });
  if (String(newPassword).length < 6)
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });
  const r = await pool.query(
    'SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()',
    [hashToken(String(token))]
  );
  if (!r.rowCount)
    return res.status(400).json({ message: 'Link inválido ou expirado. Solicite um novo.' });
  const hash = await bcrypt.hash(String(newPassword), 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      hash,
      r.rows[0].user_id,
    ]);
    await client.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [r.rows[0].id]);
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1', [
      r.rows[0].user_id,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await auditLog(r.rows[0].user_id, 'PASSWORD_RESET_COMPLETE', {}, ip, userAgent);
  res.json({ ok: true });
});

export default router;
