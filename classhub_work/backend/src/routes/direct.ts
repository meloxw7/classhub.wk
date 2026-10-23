import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
const router = Router();
router.use(auth);
const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL DEFAULT 'TEXT' CHECK (type IN ('TEXT','IMAGE','AUDIO')),
  content TEXT NOT NULL DEFAULT '',
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  duration_ms INTEGER,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages(recipient_id, read_at, created_at DESC);
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
    logger.error({ err: error }, 'Falha ao preparar tabelas de mensagens diretas');
    res.status(500).json({ message: 'Mensagens diretas indisponíveis' });
  });
});
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const AUDIO_EXTENSIONS = ['.webm', '.ogg', '.mp3', '.m4a', '.wav'];
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (_, f, cb) =>
      cb(null, `dm-${Date.now()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, f, cb) => {
    const type = String((req as AuthRequest).body?.type || '').toUpperCase();
    const ext = f.originalname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
    if (type === 'IMAGE') {
      if (!IMAGE_EXTENSIONS.includes(ext))
        return cb(new Error('Imagem: envie JPG ou PNG'));
      return cb(null, true);
    }
    if (type === 'AUDIO') {
      if (!AUDIO_EXTENSIONS.includes(ext)) return cb(new Error('Áudio: formato não suportado'));
      return cb(null, true);
    }
    cb(null, true);
  },
});
function validMedia(type: string, originalName: string) {
  const ext = originalName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  if (type === 'IMAGE') return IMAGE_EXTENSIONS.includes(ext);
  if (type === 'AUDIO') return AUDIO_EXTENSIONS.includes(ext);
  return false;
}
async function assertPartner(me: string, partner: string) {
  if (partner === me) throw { status: 400, message: 'Você não pode conversar consigo mesmo' };
  const r = await pool.query(
    'SELECT id,name,username,avatar_path,role FROM users WHERE id=$1',
    [partner]
  );
  if (!r.rowCount) throw { status: 404, message: 'Usuário não encontrado' };
  return r.rows[0];
}
function toMessage(row: any) {
  return {
    id: row.id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    type: row.type,
    content: row.content,
    filePath: row.file_path ? String(row.file_path).replace(/\\/g, '/') : null,
    fileName: row.file_name,
    durationMs: row.duration_ms,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}
router.get('/conversations', async (req: AuthRequest, res) => {
  const me = req.user!.id;
  const r = await pool.query(
    `WITH conv AS (
       SELECT CASE WHEN sender_id=$1 THEN recipient_id ELSE sender_id END partner_id, *
       FROM direct_messages WHERE sender_id=$1 OR recipient_id=$1
     )
     SELECT partner_id,id,sender_id,recipient_id,type,content,file_path,file_name,duration_ms,read_at,created_at,
       (SELECT COUNT(*)::int FROM direct_messages d WHERE d.sender_id=partner_id AND d.recipient_id=$1 AND d.read_at IS NULL) unread
     FROM conv c
     WHERE created_at = (SELECT MAX(created_at) FROM conv c2 WHERE c2.partner_id=c.partner_id)
     ORDER BY created_at DESC`,
    [me]
  );
  const partnerIds = r.rows.map((row: any) => row.partner_id);
  const users = partnerIds.length
    ? await pool.query(
        `SELECT id,name,username,avatar_path,role FROM users WHERE id = ANY($1::uuid[])`,
        [partnerIds]
      )
    : { rows: [] };
  const userMap = new Map<string, any>();
  for (const u of users.rows) userMap.set(u.id, u);
  res.json(
    r.rows.map((row: any) => {
      const partner = userMap.get(row.partner_id) || {};
      return {
        partner: {
          id: row.partner_id,
          name: partner.name || '?',
          username: partner.username || null,
          avatar_path: partner.avatar_path,
          role: partner.role,
        },
        lastMessage: toMessage(row),
        unread: Number(row.unread),
      };
    })
  );
});
router.get('/:partnerId', async (req: AuthRequest, res) => {
  const me = req.user!.id;
  const partnerId = String(req.params.partnerId);
  try {
    const partner = await assertPartner(me, partnerId);
    const r = await pool.query(
      `SELECT * FROM direct_messages
       WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)
       ORDER BY created_at DESC LIMIT 300`,
      [me, partnerId]
    );
    await pool.query(
      'UPDATE direct_messages SET read_at=NOW() WHERE recipient_id=$1 AND sender_id=$2 AND read_at IS NULL',
      [me, partnerId]
    );
    res.json({
      partner,
      messages: r.rows.reverse().map(toMessage),
    });
  } catch (error: any) {
    res.status(error?.status || 400).json({ message: error?.message || 'Erro inesperado' });
  }
});
router.patch('/:partnerId/read', async (req: AuthRequest, res) => {
  const me = req.user!.id;
  const partnerId = String(req.params.partnerId);
  if (partnerId === me)
    return res.status(400).json({ message: 'Parceiro inválido' });
  const r = await pool.query(
    'UPDATE direct_messages SET read_at=NOW() WHERE recipient_id=$1 AND sender_id=$2 AND read_at IS NULL RETURNING id',
    [me, partnerId]
  );
  res.json({ ok: true, marked: r.rowCount });
});
router.post('/upload', upload.single('file'), async (req: AuthRequest, res) => {
  const file = req.file;
  const { recipientId, type, durationMs } = req.body || {};
  const me = req.user!.id;
  if (!file) return res.status(400).json({ message: 'Arquivo obrigatório' });
  try {
    const partner = await assertPartner(me, String(recipientId || ''));
    const mediaType = String(type).toUpperCase();
    if (!validMedia(mediaType, file.originalname)) {
      fs.promises.unlink(path.resolve(file.path)).catch(() => {});
      return res.status(400).json({ message: 'Tipo ou formato de mídia inválido' });
    }
    const r = await pool.query(
      `INSERT INTO direct_messages(sender_id,recipient_id,type,content,file_path,file_name,file_size,duration_ms)
       VALUES($1,$2,$3,'',$4,$5,$6,$7) RETURNING *`,
      [
        me,
        partner.id,
        mediaType,
        file.path.replace(/\\/g, '/'),
        file.originalname,
        file.size,
        Number(durationMs) || null,
      ]
    );
    res.status(201).json(toMessage(r.rows[0]));
  } catch (error: any) {
    res.status(error?.status || 400).json({ message: error?.message || 'Erro inesperado' });
  }
});
export default router;
