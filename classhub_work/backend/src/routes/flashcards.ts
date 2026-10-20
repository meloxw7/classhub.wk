import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
const router = Router();
router.use(auth);
const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1 CHECK (box BETWEEN 1 AND 5),
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_due ON flashcards(user_id, due_at);
`;
let schemaPromise: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool
      .query(ENSURE_SQL)
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
router.use((_req, res, next) => {
  ensureSchema().then(next).catch((error) => {
    logger.error({ err: error }, 'Falha ao preparar tabela de flashcards');
    res.status(500).json({ message: 'Flashcards indisponíveis' });
  });
});
const BOX_INTERVALS_DAYS = [1, 2, 4, 7, 16];
const MAX_TEXT = 500;
function toCard(row: any) {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    box: row.box,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
    createdAt: row.created_at,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    materialId: row.material_id,
    materialTitle: row.material_title,
  };
}
const CARD_SELECT = `
  SELECT f.*,s.name subject_name,m.title material_title
  FROM flashcards f
  LEFT JOIN subjects s ON s.id=f.subject_id
  LEFT JOIN materials m ON m.id=f.material_id`;
router.get('/', async (req: AuthRequest, res) => {
  const subjectId = String(req.query.subjectId || '');
  const r = await pool.query(
    `${CARD_SELECT} WHERE f.user_id=$1 AND ($2='' OR f.subject_id::text=$2) ORDER BY f.due_at ASC`,
    [req.user!.id, subjectId]
  );
  res.json(r.rows.map(toCard));
});
router.get('/due', async (req: AuthRequest, res) => {
  const subjectId = String(req.query.subjectId || '');
  const r = await pool.query(
    `${CARD_SELECT} WHERE f.user_id=$1 AND f.due_at<=NOW() AND ($2='' OR f.subject_id::text=$2) ORDER BY f.due_at ASC LIMIT 50`,
    [req.user!.id, subjectId]
  );
  res.json(r.rows.map(toCard));
});
router.get('/stats', async (req: AuthRequest, res) => {
  const totals = await pool.query(
    `SELECT COUNT(*)::int total,
       COUNT(*) FILTER (WHERE due_at<=NOW())::int due,
       COUNT(*) FILTER (WHERE box=1)::int box1,
       COUNT(*) FILTER (WHERE box=2)::int box2,
       COUNT(*) FILTER (WHERE box=3)::int box3,
       COUNT(*) FILTER (WHERE box=4)::int box4,
       COUNT(*) FILTER (WHERE box=5)::int box5
     FROM flashcards WHERE user_id=$1`,
    [req.user!.id]
  );
  const bySubject = await pool.query(
    `SELECT s.id,s.name,COUNT(f.id)::int total,
       COUNT(f.id) FILTER (WHERE f.due_at<=NOW())::int due
     FROM subjects s LEFT JOIN flashcards f ON f.subject_id=s.id AND f.user_id=$1
     GROUP BY s.id,s.name HAVING COUNT(f.id)>0 ORDER BY s.name`,
    [req.user!.id]
  );
  const t = totals.rows[0];
  res.json({
    total: t.total,
    due: t.due,
    boxes: { 1: t.box1, 2: t.box2, 3: t.box3, 4: t.box4, 5: t.box5 },
    bySubject: bySubject.rows.map((r: any) => ({ id: r.id, name: r.name, total: r.total, due: r.due })),
  });
});
router.post('/', async (req: AuthRequest, res) => {
  const body = req.body || {};
  const front = String(body.front || '').trim();
  const back = String(body.back || '').trim();
  if (!front || !back)
    return res.status(400).json({ message: 'Preencha a frente e o verso do cartão' });
  if (front.length > MAX_TEXT || back.length > MAX_TEXT)
    return res.status(400).json({ message: `Máximo de ${MAX_TEXT} caracteres por lado` });
  const subjectId = body.subjectId ? String(body.subjectId) : null;
  const materialId = body.materialId ? String(body.materialId) : null;
  if (subjectId) {
    const s = await pool.query('SELECT 1 FROM subjects WHERE id=$1', [subjectId]);
    if (!s.rowCount) return res.status(400).json({ message: 'Disciplina inválida' });
  }
  if (materialId) {
    const m = await pool.query('SELECT 1 FROM materials WHERE id=$1', [materialId]);
    if (!m.rowCount) return res.status(400).json({ message: 'Material inválido' });
  }
  const r = await pool.query(
    `INSERT INTO flashcards(user_id,subject_id,material_id,front,back) VALUES($1,$2,$3,$4,$5)
     RETURNING id,user_id,subject_id,material_id,front,back,box,due_at,last_reviewed_at,created_at`,
    [req.user!.id, subjectId, materialId, front, back]
  );
  res.status(201).json(
    toCard({ ...r.rows[0], subject_name: null, material_title: null })
  );
});
router.patch('/:id', async (req: AuthRequest, res) => {
  const body = req.body || {};
  const front = String(body.front || '').trim();
  const back = String(body.back || '').trim();
  if (!front || !back)
    return res.status(400).json({ message: 'Preencha a frente e o verso do cartão' });
  if (front.length > MAX_TEXT || back.length > MAX_TEXT)
    return res.status(400).json({ message: `Máximo de ${MAX_TEXT} caracteres por lado` });
  const r = await pool.query(
    `UPDATE flashcards SET front=$1,back=$2 WHERE id=$3 AND user_id=$4
     RETURNING id,user_id,subject_id,material_id,front,back,box,due_at,last_reviewed_at,created_at`,
    [front, back, req.params.id, req.user!.id]
  );
  if (!r.rowCount) return res.status(404).json({ message: 'Cartão não encontrado' });
  const s = await pool.query('SELECT name FROM subjects WHERE id=$1', [r.rows[0].subject_id]);
  const m = await pool.query('SELECT title FROM materials WHERE id=$1', [r.rows[0].material_id]);
  res.json(
    toCard({
      ...r.rows[0],
      subject_name: s.rows[0]?.name,
      material_title: m.rows[0]?.title,
    })
  );
});
router.delete('/:id', async (req: AuthRequest, res) => {
  const r = await pool.query('DELETE FROM flashcards WHERE id=$1 AND user_id=$2 RETURNING id', [
    req.params.id,
    req.user!.id,
  ]);
  if (!r.rowCount) return res.status(404).json({ message: 'Cartão não encontrado' });
  res.json({ ok: true });
});
router.post('/:id/review', async (req: AuthRequest, res) => {
  const result = String(req.body?.result || '').toUpperCase();
  if (result !== 'GOOD' && result !== 'AGAIN')
    return res.status(400).json({ message: 'Resultado inválido (GOOD ou AGAIN)' });
  const current = await pool.query(
    'SELECT id,box FROM flashcards WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user!.id]
  );
  if (!current.rowCount) return res.status(404).json({ message: 'Cartão não encontrado' });
  const oldBox = current.rows[0].box;
  let box: number;
  let dueAt: string;
  if (result === 'GOOD') {
    box = Math.min(oldBox + 1, 5);
    dueAt = `NOW() + INTERVAL '${BOX_INTERVALS_DAYS[box - 1]} days'`;
  } else {
    box = 1;
    dueAt = `NOW() + INTERVAL '10 minutes'`;
  }
  const r = await pool.query(
    `UPDATE flashcards SET box=$2, due_at=${dueAt}, last_reviewed_at=NOW()
     WHERE id=$1 AND user_id=$3
     RETURNING id,user_id,subject_id,material_id,front,back,box,due_at,last_reviewed_at,created_at`,
    [req.params.id, box, req.user!.id]
  );
  res.json(toCard({ ...r.rows[0], subject_name: null, material_title: null }));
});
export default router;
