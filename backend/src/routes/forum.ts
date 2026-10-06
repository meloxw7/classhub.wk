import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
import { notifyUsers } from '../lib/notify';
const router = Router();
router.use(auth);
router.get('/', async (req, res) => {
  const r = await pool.query(
    `SELECT q.*,m.title material_title,u.name author_name,COALESCE(json_agg(json_build_object('id',fr.id,'content',fr.content,'official',fr.official,'author_name',ru.name,'created_at',fr.created_at) ORDER BY fr.created_at) FILTER (WHERE fr.id IS NOT NULL),'[]') replies FROM forum_questions q JOIN materials m ON m.id=q.material_id LEFT JOIN users u ON u.id=q.author_id LEFT JOIN forum_replies fr ON fr.question_id=q.id LEFT JOIN users ru ON ru.id=fr.author_id GROUP BY q.id,m.title,u.name ORDER BY q.created_at DESC`
  );
  res.json(r.rows);
});
router.post('/', async (req: AuthRequest, res) => {
  const { materialId, question } = req.body;
  if (!materialId || !question)
    return res.status(400).json({ message: 'Material e dúvida são obrigatórios' });
  const r = await pool.query(
    'INSERT INTO forum_questions(material_id,author_id,question) VALUES($1,$2,$3) RETURNING *',
    [materialId, req.user!.id, question]
  );
  res.status(201).json(r.rows[0]);
});
router.post('/:id/replies', async (req: AuthRequest, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Resposta obrigatória' });
  const official = req.user!.role === 'PROFESSOR';
  const r = await pool.query(
    'INSERT INTO forum_replies(question_id,author_id,content,official) VALUES($1,$2,$3,$4) RETURNING *',
    [req.params.id, req.user!.id, content, official]
  );
  await pool.query('UPDATE forum_questions SET answered=true WHERE id=$1', [req.params.id]);
  const q = await pool.query('SELECT author_id FROM forum_questions WHERE id=$1', [req.params.id]);
  if (q.rows[0]?.author_id && q.rows[0].author_id !== req.user!.id)
    await notifyUsers(
      [q.rows[0].author_id],
      'Nova resposta no fórum',
      content.slice(0, 120),
      'FORUM'
    );
  res.status(201).json(r.rows[0]);
});
export default router;
