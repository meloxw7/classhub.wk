import { Router } from 'express';
import multer from 'multer';
import { pool } from '../lib/db';
import { auth, AuthRequest, role, roleOrAdmin } from '../middleware/auth';
import { notifyAllStudents } from '../lib/notify';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

const router = Router();
router.use(auth);
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/plain',
  'application/zip',
];
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.txt', '.zip',
];
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, f, cb) =>
    cb(null, `${randomUUID()}${path.extname(f.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, f, cb) => {
    const extOk = ALLOWED_EXTENSIONS.some((x) => f.originalname.toLowerCase().endsWith(x));
    if (!extOk) return cb(new Error('Tipo de arquivo não permitido'));
    cb(null, true);
  },
});

async function validateMimeType(filePath: string): Promise<boolean> {
  const buffer = await fs.promises.readFile(filePath);
  const type = await fileTypeFromBuffer(buffer);
  return !!(type && ALLOWED_MIME_TYPES.includes(type.mime));
}

import fs from 'fs';
router.get('/', async (req: AuthRequest, res) => {
  const subjectId = String(req.query.subjectId || '');
  const tag = String(req.query.tag || '');
  const r = await pool.query(
    "SELECT m.*,s.name subject_name,u.name author_name,COALESCE(mp.completed,false) completed FROM materials m JOIN subjects s ON s.id=m.subject_id LEFT JOIN users u ON u.id=m.author_id LEFT JOIN material_progress mp ON mp.material_id=m.id AND mp.user_id=$2 WHERE ($1='' OR m.subject_id::text=$1) AND ($3='' OR $3=ANY(m.tags)) ORDER BY m.created_at DESC",
    [subjectId, req.user!.id, tag]
  );
  res.json(r.rows);
});
router.post('/', role('PROFESSOR'), upload.single('file'), async (req: AuthRequest, res) => {
  const { subjectId, title, description, type, url, tags, dueDate } = req.body;
  if (!subjectId || !title || !type)
    return res.status(400).json({ message: 'Preencha disciplina, título e tipo' });
  if (req.file) {
    const valid = await validateMimeType(req.file.path);
    if (!valid) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: 'Tipo de arquivo não permitido (assinatura inválida)' });
    }
  }
  const r = await pool.query(
    'INSERT INTO materials(subject_id,author_id,title,description,type,url,file_path,tags,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [
      subjectId,
      req.user!.id,
      title,
      description || '',
      type,
      url || null,
      req.file?.path || null,
      tags
        ? String(tags)
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean)
        : [],
      dueDate || null,
    ]
  );
  const material = r.rows[0];
  if ((type === 'EXERCICIO' || type === 'PROVA') && dueDate) {
    await pool.query(
      'INSERT INTO events(subject_id,title,description,event_date,type,color,source_material_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        subjectId,
        title,
        description || '',
        dueDate,
        type === 'EXERCICIO' ? 'TRABALHO' : 'PROVA',
        type === 'EXERCICIO' ? '#f59e0b' : '#dc2626',
        material.id,
      ]
    );
  }
  await notifyAllStudents('Novo material', `${title} foi publicado no ClassHub.`, 'MATERIAL');
  res.status(201).json(material);
});
router.patch('/:id/progress', role('ALUNO'), async (req: AuthRequest, res) => {
  const r = await pool.query(
    'INSERT INTO material_progress(user_id,material_id,completed) VALUES($1,$2,$3) ON CONFLICT(user_id,material_id) DO UPDATE SET completed=EXCLUDED.completed,updated_at=NOW() RETURNING *',
    [req.user!.id, req.params.id, !!req.body.completed]
  );
  res.json(r.rows[0]);
});
router.post('/:id/version', role('PROFESSOR'), upload.single('file'), async (req, res) => {
  const m = await pool.query('SELECT version FROM materials WHERE id=$1', [req.params.id]);
  if (!m.rowCount) return res.status(404).json({ message: 'Material não encontrado' });
  if (req.file) {
    const valid = await validateMimeType(req.file.path);
    if (!valid) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: 'Tipo de arquivo não permitido (assinatura inválida)' });
    }
  }
  const version = Number(m.rows[0].version) + 1;
  const r = await pool.query(
    'INSERT INTO material_versions(material_id,version,file_path,file_name) VALUES($1,$2,$3,$4) RETURNING *',
    [req.params.id, version, req.file?.path || null, req.file?.originalname || null]
  );
  await pool.query('UPDATE materials SET version=$1,file_path=COALESCE($2,file_path) WHERE id=$3', [
    version,
    req.file?.path || null,
    req.params.id,
  ]);
  res.status(201).json(r.rows[0]);
});
router.get('/:id/versions', async (req, res) => {
  const r = await pool.query(
    'SELECT * FROM material_versions WHERE material_id=$1 ORDER BY version DESC',
    [req.params.id]
  );
  res.json(r.rows);
});
router.delete('/:id', roleOrAdmin('PROFESSOR'), async (req, res) => {
  await pool.query('DELETE FROM materials WHERE id=$1', [req.params.id]);
  res.status(204).end();
});
export default router;
