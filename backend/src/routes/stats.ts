import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
router.get('/', async (req: AuthRequest, res) => {
  const [s, m, e, a, n] = await Promise.all([
    pool.query('SELECT COUNT(*)::int count FROM subjects'),
    pool.query('SELECT COUNT(*)::int count FROM materials'),
    pool.query(
      `SELECT COUNT(*)::int count FROM events e WHERE e.event_date>=NOW() AND (e.visibility='ALL' OR e.author_id=$1 OR (e.visibility='SELECTED' AND EXISTS(SELECT 1 FROM event_targets t WHERE t.event_id=e.id AND t.user_id=$1)))`,
      [req.user!.id]
    ),
    pool.query('SELECT COUNT(*)::int count FROM assignments WHERE due_date>=NOW()'),
    pool.query(
      'SELECT COUNT(*)::int count FROM notifications WHERE user_id=$1 AND read_at IS NULL',
      [req.user!.id]
    ),
  ]);
  res.json({
    subjects: s.rows[0].count,
    materials: m.rows[0].count,
    upcomingEvents: e.rows[0].count,
    assignments: a.rows[0].count,
    unreadNotifications: n.rows[0].count,
  });
});
export default router;
