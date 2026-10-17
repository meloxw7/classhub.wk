import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

const AI_MODEL = process.env.AI_MODEL || 'gemini-3.8-flash';

const ATTACHMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.md', '.docx'];
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
  fileFilter: (_, f, cb) => {
    const ok = ATTACHMENT_EXTENSIONS.some((x) => f.originalname.toLowerCase().endsWith(x));
    if (!ok) return cb(new Error('Anexos aceitos: .pdf, .png, .jpg, .txt, .md e .docx'));
    cb(null, true);
  },
});

async function fileToParts(file: Express.Multer.File): Promise<any[]> {
  const name = file.originalname;
  const lower = name.toLowerCase();
  if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return [
      { text: `\n\n[Arquivo anexado: ${name} — conteúdo em texto]\n${result.value.slice(0, 60000)}` },
    ];
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return [
      { text: `\n\n[Arquivo anexado: ${name}]\n${file.buffer.toString('utf8').slice(0, 60000)}` },
    ];
  }
  const mime =
    lower.endsWith('.pdf')
      ? 'application/pdf'
      : lower.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg';
  return [{ inlineData: { mimeType: mime, data: file.buffer.toString('base64') } }];
}

router.post('/chat', attachmentUpload.array('files', 3), async (req: AuthRequest, res) => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey)
    return res
      .status(503)
      .json({ message: 'Tutor IA não configurado. Defina AI_API_KEY no servidor.' });

  let parsed: any = {};
  try {
    parsed = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
  } catch {}

  const incoming = Array.isArray(parsed?.messages) ? parsed.messages : [];
  const contents = incoming
    .filter(
      (m: any) =>
        (m?.role === 'user' || m?.role === 'model') &&
        typeof m?.content === 'string' &&
        m.content.trim()
    )
    .slice(-20)
    .map((m: any) => ({ role: m.role, parts: [{ text: String(m.content).slice(0, 8000) }] }));
  if (!contents.length || contents[contents.length - 1].role !== 'user')
    return res.status(400).json({ message: 'Envie uma mensagem para o tutor.' });

  const files = (req.files as Express.Multer.File[] | undefined)?.slice(0, 3) || [];
  if (files.length) {
    try {
      const extraParts = (await Promise.all(files.map(fileToParts))).flat();
      const last = contents[contents.length - 1];
      last.parts = [...last.parts, ...extraParts];
      if (files.length === 1)
        last.parts[0].text += `\n(Anexei o arquivo ${files[0].originalname}.)`;
      else
        last.parts[0].text += `\n(Anexei ${files.length} arquivos: ${files
          .map((f) => f.originalname)
          .join(', ')}.)`;
    } catch (error: any) {
      return res
        .status(400)
        .json({ message: error?.message || 'Não foi possível ler os anexos enviados.' });
    }
  }

  let subjects: string[] = [];
  try {
    const r = await pool.query('SELECT name FROM subjects ORDER BY name LIMIT 20');
    subjects = r.rows.map((x: any) => x.name);
  } catch {}

  const who = req.user!;
  const system = [
    'Você é o Tutor IA do ClassHub, um portal acadêmico.',
    `O usuário chama-se ${who.name} e é ${who.role === 'PROFESSOR' ? 'professor' : 'aluno'}.`,
    subjects.length ? `Disciplinas do ambiente: ${subjects.join(', ')}.` : '',
    'Responda sempre em português do Brasil, de forma didática, clara e motivadora.',
    'Use exemplos práticos, listas e blocos de código quando ajudar.',
    'Se não souber algo, admita e sugira onde procurar. Não invente regras acadêmicas.',
    'O usuário pode anexar arquivos (PDF, imagens, texto). Analise-os quando presentes.',
    'Se o usuário pedir um PDF, estruture a resposta como um documento completo e bem formatado — ele poderá exportá-la em PDF.',
  ]
    .filter(Boolean)
    .join('\n');

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const controller = new AbortController();
  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {}
  }, 15000);
  req.on('close', () => {
    clearInterval(heartbeat);
    controller.abort();
  });

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    );
    if (!upstream.ok || !upstream.body) {
      clearInterval(heartbeat);
      res.write(
        `data: ${JSON.stringify({ error: 'Falha ao consultar o tutor. Tente novamente.' })}\n\n`
      );
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
        } catch {}
      }
    }
    clearInterval(heartbeat);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch {
    clearInterval(heartbeat);
    try {
      res.write(`data: ${JSON.stringify({ error: 'Erro de conexão com o tutor.' })}\n\n`);
      res.end();
    } catch {}
  }
});

export default router;
