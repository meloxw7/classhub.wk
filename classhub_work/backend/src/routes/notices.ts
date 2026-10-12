import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest, role } from '../middleware/auth';
import { notifyAllStudents } from '../lib/notify';
const router = Router();
router.use(auth);
router.get('/', async (req, res) => {
  const r = await pool.query(
    'SELECT n.*,s.name subject_name,u.name author_name FROM notices n LEFT JOIN subjects s ON s.id=n.subject_id LEFT JOIN users u ON u.id=n.author_id ORDER BY pinned DESC,created_at DESC'
  );
  res.json(r.rows);
});
router.post('/', role('PROFESSOR'), async (req: AuthRequest, res) => {
  const { subjectId, title, content, pinned } = req.body;
  if (!title || !content)
    return res.status(400).json({ message: 'Título e conteúdo são obrigatórios' });
  const r = await pool.query(
    'INSERT INTO notices(subject_id,author_id,title,content,pinned) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [subjectId, req.user!.id, title, content, !!pinned]
  );
  await notifyAllStudents('Novo aviso', title, 'NOTICE');
  res.status(201).json(r.rows[0]);
});
export default router;
