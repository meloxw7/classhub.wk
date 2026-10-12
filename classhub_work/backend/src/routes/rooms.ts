import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest, role } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/', async (req, res) => {
  const r = await pool.query(
    'SELECT r.*,s.name subject_name,u.name creator_name,(SELECT COUNT(*) FROM study_posts p WHERE p.room_id=r.id) post_count FROM study_rooms r JOIN subjects s ON s.id=r.subject_id LEFT JOIN users u ON u.id=r.created_by ORDER BY r.created_at DESC'
  );
  res.json(r.rows);
});
router.post('/', role('PROFESSOR', 'ALUNO'), async (req: AuthRequest, res) => {
  const { subjectId, name, description } = req.body;
  const r = await pool.query(
    'INSERT INTO study_rooms(subject_id,name,description,created_by) VALUES($1,$2,$3,$4) RETURNING *',
    [subjectId, name, description || '', req.user!.id]
  );
  res.status(201).json(r.rows[0]);
});
router.get('/:id/posts', async (req, res) => {
  const r = await pool.query(
    'SELECT p.*,u.name author_name FROM study_posts p LEFT JOIN users u ON u.id=p.author_id WHERE room_id=$1 ORDER BY p.created_at ASC',
    [req.params.id]
  );
  res.json(r.rows);
});
router.post('/:id/posts', async (req: AuthRequest, res) => {
  const { content, link } = req.body;
  if (!content) return res.status(400).json({ message: 'Mensagem obrigatória' });
  const r = await pool.query(
    'INSERT INTO study_posts(room_id,author_id,content,link) VALUES($1,$2,$3,$4) RETURNING *',
    [req.params.id, req.user!.id, content, link || null]
  );
  res.status(201).json(r.rows[0]);
});
export default router;
