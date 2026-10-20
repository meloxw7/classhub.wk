import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/db';
import { getJwtSecret } from '../lib/env';
import { generateToken, hashToken } from '../lib/tokens';
import { sendMail } from '../lib/mailer';
import { ensureUsernameSchema, uniqueUsername, USERNAME_RE } from '../lib/username';

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

router.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios' });
  const r = await pool.query(
    'SELECT id,name,username,email,password_hash,role,course,semester,ra,institution FROM users WHERE email=$1',
    [String(email).toLowerCase().trim()]
  );
  if (!r.rowCount || !(await bcrypt.compare(password, r.rows[0].password_hash)))
    return res.status(401).json({ message: 'Credenciais inválidas' });
  const u = r.rows[0];
  const session = await issueSession(u, !!rememberMe);
  const { password_hash: _hash, ...user } = u;
  res.json({ ...session, user });
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
  res.status(201).json({ ...session, user: u });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(401).json({ message: 'Sessão expirada' });
  const r = await pool.query(
    `SELECT rt.id AS rt_id, u.id, u.name, u.email, u.role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
    [hashToken(String(refreshToken))]
  );
  if (!r.rowCount) return res.status(401).json({ message: 'Sessão expirada' });
  const u = r.rows[0];
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [u.rt_id]);
  res.json(await issueSession(u));
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (refreshToken)
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [
      hashToken(String(refreshToken)),
    ]);
  res.json({ ok: true });
});

router.post('/forgot', async (req, res) => {
  const { email } = req.body || {};
  if (email) {
    const r = await pool.query('SELECT id, name FROM users WHERE email = $1', [String(email)]);
    if (r.rowCount) {
      const token = generateToken();
      await pool.query(
        "INSERT INTO password_resets(user_id, token_hash, expires_at) VALUES($1, $2, NOW() + INTERVAL '1 hour')",
        [r.rows[0].id, hashToken(token)]
      );
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
  res.json({ ok: true });
});

export default router;
