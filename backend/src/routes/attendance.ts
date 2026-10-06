import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest, role } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/sessions', role('PROFESSOR'), async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT s.*,sub.name subject_name,(SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id=s.id)::int present_count FROM attendance_sessions s JOIN subjects sub ON sub.id=s.subject_id WHERE s.professor_id=$1 ORDER BY s.created_at DESC LIMIT 20',
    [req.user!.id]
  );
  res.json(r.rows);
});
router.post('/open', role('PROFESSOR'), async (req: AuthRequest, res) => {
  const { subjectId, minutes } = req.body;
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const mins = Math.min(Math.max(Number(minutes) || 10, 1), 120);
  const r = await pool.query(
    "INSERT INTO attendance_sessions(subject_id,professor_id,pin,expires_at) VALUES($1,$2,$3,NOW()+($4 || ' minutes')::interval) RETURNING *",
    [subjectId, req.user!.id, pin, mins]
  );
  res.status(201).json(r.rows[0]);
});
router.patch('/sessions/:id/close', role('PROFESSOR'), async (req: AuthRequest, res) => {
  const r = await pool.query(
    'UPDATE attendance_sessions SET expires_at=NOW() WHERE id=$1 AND professor_id=$2 AND expires_at>NOW() RETURNING *',
    [req.params.id, req.user!.id]
  );
  if (!r.rowCount)
    return res.status(404).json({ message: 'Chamada não encontrada ou já encerrada' });
  res.json(r.rows[0]);
});
router.post('/mark', role('ALUNO'), async (req: AuthRequest, res) => {
  const { pin } = req.body;
  const s = await pool.query(
    'SELECT * FROM attendance_sessions WHERE pin=$1 AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1',
    [pin]
  );
  if (!s.rowCount) return res.status(400).json({ message: 'PIN inválido ou expirado' });
  try {
    await pool.query('INSERT INTO attendance_records(session_id,student_id) VALUES($1,$2)', [
      s.rows[0].id,
      req.user!.id,
    ]);
    res.json({ message: 'Presença registrada' });
  } catch {
    return res.status(409).json({ message: 'Presença já registrada' });
  }
});
router.get('/mine', role('ALUNO'), async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT ar.*,s.pin,sub.name subject_name FROM attendance_records ar JOIN attendance_sessions s ON s.id=ar.session_id JOIN subjects sub ON sub.id=s.subject_id WHERE ar.student_id=$1 ORDER BY ar.marked_at DESC',
    [req.user!.id]
  );
  res.json(r.rows);
});
export default router;
