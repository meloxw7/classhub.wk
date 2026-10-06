import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
import { notifyAllStudents, notifyUsers } from '../lib/notify';
const router = Router();
router.use(auth);
router.get('/', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT e.*,s.name subject_name,u.name author_name FROM events e LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN users u ON u.id=e.author_id WHERE e.visibility='ALL' OR e.author_id=$1 OR (e.visibility='SELECTED' AND EXISTS(SELECT 1 FROM event_targets t WHERE t.event_id=e.id AND t.user_id=$1)) ORDER BY event_date`,
    [req.user!.id]
  );
  res.json(r.rows);
});
router.post('/', async (req: AuthRequest, res) => {
  const { subjectId, title, description, eventDate, type, color, visibility, targetIds } = req.body;
  if (!title || !eventDate)
    return res.status(400).json({ message: 'Título e data são obrigatórios' });
  let vis = 'ALL';
  if (req.user!.role === 'ALUNO') vis = 'PRIVATE';
  else if (visibility === 'SELECTED' || visibility === 'PRIVATE') vis = visibility;
  const targets =
    vis === 'SELECTED' && Array.isArray(targetIds)
      ? targetIds.filter((x: any) => typeof x === 'string' && x.trim())
      : [];
  if (vis === 'SELECTED' && !targets.length)
    return res.status(400).json({ message: 'Selecione pelo menos um aluno' });
  const r = await pool.query(
    'INSERT INTO events(subject_id,author_id,title,description,event_date,type,color,visibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [
      subjectId || null,
      req.user!.id,
      title,
      description || '',
      eventDate,
      type || 'OUTRO',
      color || null,
      vis,
    ]
  );
  const event = r.rows[0];
  if (targets.length)
    await pool.query(
      'INSERT INTO event_targets(event_id,user_id) SELECT $1,x FROM unnest($2::uuid[]) x ON CONFLICT DO NOTHING',
      [event.id, targets]
    );
  if (req.user!.role === 'PROFESSOR') {
    if (vis === 'ALL')
      await notifyAllStudents(
        'Novo evento na agenda',
        `${title} foi adicionado à agenda.`,
        'EVENT'
      );
    else if (vis === 'SELECTED')
      await notifyUsers(
        targets,
        'Novo evento na agenda',
        `${title} foi adicionado à agenda para você.`,
        'EVENT'
      );
  }
  res.status(201).json(event);
});
export default router;
