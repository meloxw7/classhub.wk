import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/:subjectId', async (req: AuthRequest, res) => {
  const r = await pool.query('SELECT * FROM notes WHERE user_id=$1 AND subject_id=$2', [
    req.user!.id,
    req.params.subjectId,
  ]);
  res.json(r.rows[0] || { content: '' });
});
router.put('/:subjectId', async (req: AuthRequest, res) => {
  const { content } = req.body;
  const r = await pool.query(
    'INSERT INTO notes(user_id,subject_id,content) VALUES($1,$2,$3) ON CONFLICT(user_id,subject_id) DO UPDATE SET content=EXCLUDED.content,updated_at=NOW() RETURNING *',
    [req.user!.id, req.params.subjectId, content || '']
  );
  res.json(r.rows[0]);
});
export default router;
