import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db';
import { auth, role, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
const AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (_, f, cb) =>
      cb(null, `avatar-${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    const ok = AVATAR_EXTENSIONS.some((x) => f.originalname.toLowerCase().endsWith(x));
    if (!ok) return cb(new Error('Envie uma imagem JPG ou PNG'));
    cb(null, true);
  },
});
router.get('/students', role('PROFESSOR'), async (_req, res) => {
  const r = await pool.query("SELECT id,name,email FROM users WHERE role='ALUNO' ORDER BY name");
  res.json(r.rows);
});
router.get('/me', async (req: AuthRequest, res) => {
  const r = await pool.query('SELECT id,name,email,role,avatar_path FROM users WHERE id=$1', [
    req.user!.id,
  ]);
  if (!r.rowCount) return res.status(404).json({ message: 'Usuário não encontrado' });
  res.json(r.rows[0]);
});
router.put('/me', async (req: AuthRequest, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ message: 'Informe o nome' });
  const r = await pool.query(
    'UPDATE users SET name=$1 WHERE id=$2 RETURNING id,name,email,role,avatar_path',
    [String(name).trim(), req.user!.id]
  );
  res.json(r.rows[0]);
});
router.put('/password', async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: 'Preencha a senha atual e a nova senha' });
  if (String(newPassword).length < 6)
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });
  const r = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
  if (!r.rowCount || !(await bcrypt.compare(String(currentPassword), r.rows[0].password_hash)))
    return res.status(401).json({ message: 'Senha atual incorreta' });
  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user!.id]);
  res.json({ ok: true });
});
router.post('/me/avatar', avatarUpload.single('avatar'), async (req, res) => {
  const file = req.file;
  const user = (req as AuthRequest).user;
  if (!user) return res.status(401).json({ message: 'Não autenticado' });
  if (!file) return res.status(400).json({ message: 'Arquivo obrigatório (JPG ou PNG)' });
  const previous = await pool.query('SELECT avatar_path FROM users WHERE id=$1', [user.id]);
  const oldPath = previous.rows[0]?.avatar_path;
  const r = await pool.query(
    'UPDATE users SET avatar_path=$1 WHERE id=$2 RETURNING id,name,email,role,avatar_path',
    [file.path.replace(/\\/g, '/'), user.id]
  );
  if (oldPath && oldPath !== r.rows[0].avatar_path) {
    fs.promises.unlink(path.resolve(oldPath)).catch(() => {});
  }
  res.json(r.rows[0]);
});
export default router;
