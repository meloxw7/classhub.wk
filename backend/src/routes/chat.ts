import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/:subjectId', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT c.id,c.subject_id,c.user_id,c.content,c.created_at,u.name user_name,u.avatar_path FROM chat_messages c LEFT JOIN users u ON u.id=c.user_id WHERE c.subject_id=$1 ORDER BY c.created_at DESC LIMIT 100',
    [req.params.subjectId]
  );
  res.json(
    r.rows.reverse().map((m: any) => ({
      ...m,
      userId: m.user_id,
      userName: m.user_name,
      avatar: m.avatar_path,
      createdAt: m.created_at,
    }))
  );
});
export default router;
