import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/vapid-public', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});
router.get('/', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
    [req.user!.id]
  );
  res.json(r.rows);
});
router.patch('/:id/read', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',
    [req.params.id, req.user!.id]
  );
  if (!r.rowCount) return res.status(404).json({ message: 'Notificação não encontrada' });
  res.json(r.rows[0]);
});
router.patch('/read-all', async (req: AuthRequest, res) => {
  await pool.query('UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL', [
    req.user!.id,
  ]);
  res.json({ ok: true });
});
router.delete('/', async (req: AuthRequest, res) => {
  await pool.query('DELETE FROM notifications WHERE user_id=$1', [req.user!.id]);
  res.json({ ok: true });
});
router.delete('/:id', async (req: AuthRequest, res) => {
  const r = await pool.query('DELETE FROM notifications WHERE id=$1 AND user_id=$2', [
    req.params.id,
    req.user!.id,
  ]);
  if (!r.rowCount) return res.status(404).json({ message: 'Notificação não encontrada' });
  res.json({ ok: true });
});
router.post('/subscribe', async (req: AuthRequest, res) => {
  const { endpoint, subscription } = req.body;
  if (!endpoint || !subscription) return res.status(400).json({ message: 'Assinatura inválida' });
  await pool.query(
    'INSERT INTO push_subscriptions(user_id,endpoint,subscription) VALUES($1,$2,$3) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,subscription=EXCLUDED.subscription',
    [req.user!.id, endpoint, subscription]
  );
  res.json({ ok: true });
});
export default router;
