import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
const uploadDir = path.resolve('uploads');
async function userCanAccessFile(userId: string, filePath: string): Promise<boolean> {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const checks = await Promise.all([
    pool.query('SELECT 1 FROM users WHERE id=$1 AND avatar_path=$2', [userId, normalizedPath]),
    pool.query('SELECT 1 FROM materials WHERE file_path=$2 AND (author_id=$1 OR EXISTS (SELECT 1 FROM subjects s WHERE s.id=materials.subject_id AND s.professor_id=$1))', [userId, normalizedPath]),
    pool.query('SELECT 1 FROM material_versions WHERE file_path=$2 AND EXISTS (SELECT 1 FROM materials m WHERE m.id=material_versions.material_id AND (m.author_id=$1 OR EXISTS (SELECT 1 FROM subjects s WHERE s.id=m.subject_id AND s.professor_id=$1)))', [userId, normalizedPath]),
    pool.query('SELECT 1 FROM direct_messages WHERE (sender_id=$1 OR recipient_id=$1) AND file_path=$2', [userId, normalizedPath]),
    pool.query('SELECT 1 FROM submissions WHERE student_id=$1 AND file_path=$2', [userId, normalizedPath]),
  ]);
  return checks.some((c) => c.rowCount && c.rowCount > 0);
}
router.get('/*', async (req: AuthRequest, res) => {
  const requestedPath = req.params[0] || '';
  const normalizedPath = requestedPath.replace(/\\/g, '/');
  const fullPath = path.resolve(uploadDir, normalizedPath);
  if (!fullPath.startsWith(uploadDir)) {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  try {
    await fs.promises.access(fullPath);
  } catch {
    return res.status(404).json({ message: 'Arquivo não encontrado' });
  }
  const canAccess = await userCanAccessFile(req.user!.id, normalizedPath);
  if (!canAccess) {
    return res.status(403).json({ message: 'Acesso negado' });
  }
  const ext = path.extname(fullPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const stat = await fs.promises.stat(fullPath);
  res.setHeader('Content-Length', stat.size);
  const fileStream = fs.createReadStream(fullPath);
  fileStream.pipe(res);
});
export default router;