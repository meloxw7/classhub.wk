import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

const AI_MODEL = process.env.AI_MODEL || 'gemini-3.8-flash';

router.post('/chat', async (req: AuthRequest, res) => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey)
    return res
      .status(503)
      .json({ message: 'Tutor IA não configurado. Defina AI_API_KEY no servidor.' });

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
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
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
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
