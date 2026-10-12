import { Router } from 'express';
import multer from 'multer';
import { pool } from '../lib/db';
import { auth, AuthRequest, role } from '../middleware/auth';
import { notifyUsers } from '../lib/notify';
const router = Router();
router.use(auth);
const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });
router.get('/', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT a.*,s.name subject_name,sub.id submission_id,sub.file_name,sub.score,sub.feedback,sub.submitted_at,(SELECT COUNT(*) FROM submissions x WHERE x.assignment_id=a.id)::int submission_count,(SELECT COUNT(*) FROM submissions y WHERE y.assignment_id=a.id AND y.score IS NULL)::int pending_grading FROM assignments a JOIN subjects s ON s.id=a.subject_id LEFT JOIN submissions sub ON sub.assignment_id=a.id AND sub.student_id=$1 ORDER BY due_date`,
    [req.user!.id]
  );
  res.json(r.rows);
});
router.post('/', role('PROFESSOR'), async (req, res) => {
  const { subjectId, title, description, dueDate, maxScore } = req.body;
  if (!subjectId || !title || !dueDate)
    return res.status(400).json({ message: 'Campos obrigatórios' });
  const r = await pool.query(
    'INSERT INTO assignments(subject_id,title,description,due_date,max_score) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [subjectId, title, description || '', dueDate, maxScore || 10]
  );
  const assignment = r.rows[0];
  await pool.query(
    'INSERT INTO events(subject_id,title,description,event_date,type,color,source_assignment_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [subjectId, title, description || '', dueDate, 'TRABALHO', '#f59e0b', assignment.id]
  );
  const students = await pool.query("SELECT id FROM users WHERE role='ALUNO'");
  await notifyUsers(
    students.rows.map((x) => x.id),
    'Novo trabalho',
    `${title} foi criado. Entrega: ${new Date(dueDate).toLocaleString('pt-BR')}`,
    'ASSIGNMENT'
  );
  res.status(201).json(assignment);
});
router.delete('/:id', role('PROFESSOR'), async (req: AuthRequest, res) => {
  const r = await pool.query('DELETE FROM assignments WHERE id=$1 RETURNING id', [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ message: 'Trabalho não encontrado' });
  res.status(204).end();
});
router.get('/:id/submissions', role('PROFESSOR'), async (req, res) => {
  const r = await pool.query(
    'SELECT s.*,u.name student_name,u.email FROM submissions s JOIN users u ON u.id=s.student_id WHERE assignment_id=$1 ORDER BY submitted_at DESC',
    [req.params.id]
  );
  res.json(r.rows);
});
router.patch('/submissions/:id', role('PROFESSOR'), async (req, res) => {
  const { score, feedback } = req.body;
  const r = await pool.query(
    'UPDATE submissions SET score=$1,feedback=$2 WHERE id=$3 RETURNING *',
    [score, feedback || '', req.params.id]
  );
  if (!r.rowCount) return res.status(404).json({ message: 'Entrega não encontrada' });
  const s = await pool.query('SELECT student_id FROM submissions WHERE id=$1', [req.params.id]);
  await notifyUsers(
    [s.rows[0].student_id],
    'Trabalho corrigido',
    'Seu professor publicou uma nota ou feedback.',
    'GRADE'
  );
  res.json(r.rows[0]);
});
router.post('/:id/submit', role('ALUNO'), upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo obrigatório' });
  if (req.file.size === 0)
    return res.status(400).json({ message: 'O arquivo selecionado não pode estar vazio.' });
  const allowed = ['.pdf', '.docx', '.zip', '.mp4', '.png', '.jpg', '.jpeg'];
  if (!allowed.some((x) => req.file!.originalname.toLowerCase().endsWith(x)))
    return res.status(400).json({ message: 'Formato não permitido.' });
  const r = await pool.query(
    'INSERT INTO submissions(assignment_id,student_id,file_path,file_name,file_size) VALUES($1,$2,$3,$4,$5) ON CONFLICT(assignment_id,student_id) DO UPDATE SET file_path=EXCLUDED.file_path,file_name=EXCLUDED.file_name,file_size=EXCLUDED.file_size,submitted_at=NOW() RETURNING *',
    [req.params.id, req.user!.id, req.file.path, req.file.originalname, req.file.size]
  );
  res.status(201).json(r.rows[0]);
});
export default router;
