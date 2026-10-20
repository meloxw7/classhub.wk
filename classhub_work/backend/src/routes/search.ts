import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

router.get('/', async (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ materials: [], events: [], notices: [] });
  const like = `%${q}%`;
  const [materials, events, notices] = await Promise.all([
    pool.query(
      `SELECT m.id,m.title,m.type,m.subject_id,s.name subject_name
       FROM materials m JOIN subjects s ON s.id=m.subject_id
       WHERE m.title ILIKE $1 OR m.description ILIKE $1 OR $1 = ANY(m.tags)
       ORDER BY m.created_at DESC LIMIT 5`,
      [like]
    ),
    pool.query(
      `SELECT e.id,e.title,e.event_date,e.type,e.subject_id,s.name subject_name
       FROM events e LEFT JOIN subjects s ON s.id=e.subject_id
       WHERE e.title ILIKE $1
         AND (e.visibility='ALL' OR e.author_id=$2
              OR (e.visibility='SELECTED' AND EXISTS(SELECT 1 FROM event_targets t WHERE t.event_id=e.id AND t.user_id=$2)))
       ORDER BY e.event_date DESC LIMIT 5`,
      [like, req.user!.id]
    ),
    pool.query(
      `SELECT n.id,n.title,n.pinned,n.created_at,s.name subject_name
       FROM notices n LEFT JOIN subjects s ON s.id=n.subject_id
       WHERE n.title ILIKE $1 OR n.content ILIKE $1
       ORDER BY n.pinned DESC, n.created_at DESC LIMIT 5`,
      [like]
    ),
  ]);
  res.json({
    materials: materials.rows,
    events: events.rows,
    notices: notices.rows,
  });
});
export default router;
