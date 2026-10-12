import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../lib/db';
import { getJwtSecret } from '../lib/env';
import { generateToken, hashToken } from '../lib/tokens';
import { sendMail } from '../lib/mailer';

const router = Router();

async function issueSession(user: { id: string; name: string; email: string; role: string }) {
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '2h' }
  );
  const refreshToken = generateToken();
  await pool.query(
    "INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES($1, $2, NOW() + INTERVAL '30 days')",
    [user.id, hashToken(refreshToken)]
  );
  return { token, refreshToken };
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios' });
  const r = await pool.query('SELECT id,name,email,password_hash,role FROM users WHERE email=$1', [
    email,
  ]);
  if (!r.rowCount || !(await bcrypt.compare(password, r.rows[0].password_hash)))
    return res.status(401).json({ message: 'Credenciais inválidas' });
  const u = r.rows[0];
  const session = await issueSession(u);
  res.json({ ...session, user: { id: u.id, name: u.name, email: u.email, role: u.role } });
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
