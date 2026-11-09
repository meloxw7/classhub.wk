import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import auth from './routes/auth';
import subjects from './routes/subjects';
import materials from './routes/materials';
import notes from './routes/notes';
import events from './routes/events';
import notices from './routes/notices';
import assignments from './routes/assignments';
import rooms from './routes/rooms';
import notifications from './routes/notifications';
import progress from './routes/progress';
import stats from './routes/stats';
import users from './routes/users';
import abnt from './routes/abnt';
import chat from './routes/chat';
import grades from './routes/grades';
import search from './routes/search';
import tutor from './routes/tutor';
import docs from './routes/docs';
import social from './routes/social';
import direct from './routes/direct';
import flashcards from './routes/flashcards';
import files from './routes/files';
import twoFactor from './routes/twoFactor';
import cspReport from './routes/cspReport';
import { initRedis, createRateLimiter } from './lib/rateLimit';
import { ensureCsrfToken, csrfProtection } from './lib/csrf';
dotenv.config();
const app = express();
const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.disable('x-powered-by');
app.use(cookieParser());
app.use(ensureCsrfToken);
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({ message: 'Request timeout' });
  });
  next();
});
app.use(csrfProtection);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        mediaSrc: ["'self'", 'blob:'],
        reportUri: '/api/csp-report',
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = [
  clientUrl,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
].filter((v, i, a) => v && a.indexOf(v) === i);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origem não permitida pelo CORS'));
    },
    credentials: true,
  })
);
app.use('/api/abnt', express.json({ limit: '80mb' }));
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (_, res) =>
  res.json({ ok: true, service: 'ClassHub API', time: new Date().toISOString() })
);

const API_LIMIT = Number(process.env.API_RATE_LIMIT) || 240;
app.use('/api', createRateLimiter(API_LIMIT, 60000, 'api'));
app.use('/api/auth', createRateLimiter(30, 60000, 'auth'));

initRedis().catch(() => {});

app.use('/api/auth', auth);
app.use('/api/subjects', subjects);
app.use('/api/materials', materials);
app.use('/api/notes', notes);
app.use('/api/events', events);
app.use('/api/notices', notices);
app.use('/api/assignments', assignments);
app.use('/api/rooms', rooms);
app.use('/api/notifications', notifications);
app.use('/api/progress', progress);
app.use('/api/stats', stats);
app.use('/api/users', users);
app.use('/api/abnt', abnt);
app.use('/api/chat', chat);
app.use('/api/grades', grades);
app.use('/api/search', search);
app.use('/api/tutor', tutor);
app.use('/api/docs', docs);
app.use('/api/social', social);
app.use('/api/direct', direct);
app.use('/api/flashcards', flashcards);
app.use('/api/files', files);
app.use('/api/users', twoFactor);
app.use('/api', cspReport);
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
