import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT s.id,s.name,s.code,COUNT(m.id)::int total,COUNT(m.id) FILTER(WHERE COALESCE(mp.completed,false))::int completed,CASE WHEN COUNT(m.id)=0 THEN 0 ELSE ROUND(COUNT(m.id) FILTER(WHERE COALESCE(mp.completed,false))*100.0/COUNT(m.id)) END::int progress FROM subjects s LEFT JOIN materials m ON m.subject_id=s.id LEFT JOIN material_progress mp ON mp.material_id=m.id AND mp.user_id=$1 GROUP BY s.id ORDER BY s.name`,
    [req.user!.id]
  );
  res.json(r.rows);
});
export default router;
