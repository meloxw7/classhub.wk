import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import auth from './routes/auth';
import subjects from './routes/subjects';
import materials from './routes/materials';
import notes from './routes/notes';
import events from './routes/events';
import notices from './routes/notices';
import assignments from './routes/assignments';
import attendance from './routes/attendance';
import forum from './routes/forum';
import rooms from './routes/rooms';
import notifications from './routes/notifications';
import progress from './routes/progress';
import stats from './routes/stats';
import users from './routes/users';
import abnt from './routes/abnt';
import chat from './routes/chat';
import grades from './routes/grades';
import search from './routes/search';
import docs from './routes/docs';
dotenv.config();
const app = express();
const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.disable('x-powered-by');
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } })
);
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use('/api/abnt', express.json({ limit: '80mb' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));
app.get('/api/health', (_, res) =>
  res.json({ ok: true, service: 'ClassHub API', time: new Date().toISOString() })
);
const apiHits = new Map<string, { n: number; t: number }>();
const API_LIMIT = Number(process.env.API_RATE_LIMIT) || 240;
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const h = apiHits.get(ip);
  if (!h || now - h.t > 60000) {
    if (apiHits.size > 5000) apiHits.clear();
    apiHits.set(ip, { n: 1, t: now });
    return next();
  }
  h.n++;
  if (h.n > API_LIMIT)
    return res.status(429).json({ message: 'Muitas requisições. Tente novamente em instantes.' });
  next();
});
const hits = new Map<string, { n: number; t: number }>();
app.use('/api/auth', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60000) {
    hits.set(ip, { n: 1, t: now });
    return next();
  }
  h.n++;
  if (h.n > 30)
    return res.status(429).json({ message: 'Muitas tentativas. Tente novamente em instantes.' });
  next();
});
app.use('/api/auth', auth);
app.use('/api/subjects', subjects);
app.use('/api/materials', materials);
app.use('/api/notes', notes);
app.use('/api/events', events);
app.use('/api/notices', notices);
app.use('/api/assignments', assignments);
app.use('/api/attendance', attendance);
app.use('/api/forum', forum);
app.use('/api/rooms', rooms);
app.use('/api/notifications', notifications);
app.use('/api/progress', progress);
app.use('/api/stats', stats);
app.use('/api/users', users);
app.use('/api/abnt', abnt);
app.use('/api/chat', chat);
app.use('/api/grades', grades);
app.use('/api/search', search);
app.use('/api/docs', docs);
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    const limitMb = err?.field === 'avatar' ? 2 : 50;
    return res
      .status(400)
      .json({ message: `O arquivo excede o limite máximo permitido de ${limitMb}MB.` });
  }
  res.status(err?.status || 400).json({ message: err?.message || 'Erro inesperado' });
});
export default app;
