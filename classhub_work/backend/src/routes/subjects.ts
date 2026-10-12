import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest, role } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT s.*,u.name professor_name FROM subjects s LEFT JOIN users u ON u.id=s.professor_id ORDER BY s.name'
  );
  res.json(r.rows);
});
router.post('/', role('PROFESSOR'), async (req: AuthRequest, res) => {
  const { name, code } = req.body;
  const r = await pool.query(
    'INSERT INTO subjects(name,code,professor_id) VALUES($1,$2,$3) RETURNING *',
    [name, code, req.user!.id]
  );
  res.status(201).json(r.rows[0]);
});
export default router;
