import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

const AI_MODEL = process.env.AI_MODEL || 'gemini-3.8-flash';
const TUTOR_NAME = process.env.TUTOR_NAME || 'Lumi';

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
      .json({ message: 'A Lumi não está disponível. Defina AI_API_KEY no servidor.' });

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
    `Você é a ${TUTOR_NAME}, a assistente de estudos do ClassHub.`,
    `O usuário chama-se ${who.name} e é ${who.role === 'PROFESSOR' ? 'professor' : 'aluno'}.`,
    subjects.length ? `Disciplinas do ambiente: ${subjects.join(', ')}.` : '',
    'Responda sempre em português do Brasil, de forma didática, clara e motivadora.',
    'Use exemplos práticos, listas e blocos de código quando ajudar.',
    'Se não souber algo, admita e sugira onde procurar. Não invente regras acadêmicas.',
    'O usuário pode anexar arquivos (PDF, imagens, texto). Analise-os quando presentes.',
    'Se o usuário pedir um PDF, estruture a resposta como um documento completo e bem formatado — ele poderá exportá-la em PDF.',
    'REGRAS DE ESTILO (obrigatórias):',
    '- NUNCA encerre respostas com despedidas ou ofertas repetidas de ajuda (ex.: "é só me chamar", "se precisar, estou aqui", "posso ajudar com mais alguma coisa").',
    '- NUNCA liste as disciplinas em fechamentos ou despedidas.',
    '- Responda exatamente o que foi pedido e encerre a mensagem naturalmente, sem parágrafos finais de cortesia.',
    `- Assuma a identidade da ${TUTOR_NAME} de forma sutil: nunca se apresente repetidamente, nunca diga que é um "tutor" — você é a ${TUTOR_NAME}.`,
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

/* ---- geração de PDF real (pdfkit) ---- */

type InlinePart = { text: string; bold: boolean; code: boolean };

function inlineSegments(line: string): InlinePart[] {
  const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part) => ({
    text: part.startsWith('**') ? part.slice(2, -2) : part.startsWith('`') ? part.slice(1, -1) : part,
    bold: part.startsWith('**'),
    code: part.startsWith('`'),
  }));
}

async function renderPdf(content: string, title: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 56, right: 56 },
    info: { Title: title || 'Resposta da Lumi', Author: `${TUTOR_NAME} — ClassHub` },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 56 * 2;
  const ink = '#101014';
  const violet = '#7c3aed';

  // Cabeçalho
  doc.roundedRect(56, 48, 26, 26, 6).fill(violet);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text('L', 64, 54);
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(14).text(`${TUTOR_NAME} — ClassHub`, 92, 50);
  doc.fillColor('#94a3b8').font('Helvetica').fontSize(8).text(
    new Date().toLocaleString('pt-BR'),
    92,
    66
  );
  doc
    .moveTo(56, 90)
    .lineTo(pageWidth - 56, 90)
    .lineWidth(2)
    .strokeColor(violet)
    .stroke();
  doc.y = 106;

  if (title) {
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text(title, { width: contentWidth });
    doc.moveDown(0.5);
  }

  const writeInline = (line: string, baseSize: number, indent = 0) => {
    const parts = inlineSegments(line);
    const width = contentWidth - indent;
    doc.fillColor(ink).fontSize(baseSize);
    parts.forEach((part, index) => {
      const last = index === parts.length - 1;
      doc
        .font(part.code ? 'Courier' : part.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(part.code ? '#5b21b6' : ink)
        .text(part.text, indent ? 56 + indent : undefined, undefined, {
          width,
          continued: !last,
          lineGap: 3,
        });
    });
    if (!parts.length) doc.text('', { width });
  };

  const blocks = content.split(/```/);
  blocks.forEach((block, blockIndex) => {
    if (blockIndex % 2 === 1) {
      const lines = block.split('\n');
      const lang = /^[a-z]+$/i.test(lines[0].trim()) ? lines.shift()?.trim() : '';
      const code = (lang ? lines.join('\n') : block).replace(/\n+$/, '');
      if (!code.trim()) return;
      const fontSize = 9;
      doc.font('Courier').fontSize(fontSize);
      const textHeight = doc.heightOfString(code, { width: contentWidth - 20 }) + 16;
      if (doc.y + textHeight > doc.page.height - 60) doc.addPage();
      const top = doc.y;
      doc
        .rect(56, top, contentWidth, textHeight)
        .lineWidth(1)
        .fillAndStroke('#f5f3ff', '#ddd6fe');
      if (lang) {
        doc.fillColor(violet).font('Helvetica-Bold').fontSize(7.5).text(lang.toUpperCase(), 66, top + 6, {
          width: contentWidth - 20,
        });
      }
      doc
        .fillColor('#101014')
        .font('Courier')
        .fontSize(fontSize)
        .text(code, 66, top + (lang ? 16 : 8), { width: contentWidth - 20 });
      doc.y = top + textHeight + 8;
      return;
    }
    for (const raw of block.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (!line.trim()) {
        doc.moveDown(0.4);
        continue;
      }
      if (heading) {
        const level = heading[1].length;
        doc.moveDown(0.6);
        doc
          .fillColor(level === 1 ? violet : ink)
          .font('Helvetica-Bold')
          .fontSize(level === 1 ? 15 : level === 2 ? 12.5 : 11.5)
          .text(heading[2], { width: contentWidth, lineGap: 2 });
        doc.moveDown(0.35);
        continue;
      }
      if (bullet) {
        doc.fillColor(violet).font('Helvetica-Bold').fontSize(10.5).text('•', 56, undefined, {
          width: 12,
          continued: true,
        });
        writeInline(bullet[1], 10.5, 14);
        continue;
      }
      if (numbered) {
        doc
          .fillColor(violet)
          .font('Helvetica-Bold')
          .fontSize(10.5)
          .text(`${numbered[1]}.`, 56, undefined, { width: 20, continued: true });
        writeInline(numbered[2], 10.5, 20);
        continue;
      }
      writeInline(line, 10.5);
      doc.moveDown(0.15);
    }
  });

  doc.end();
  return finished;
}

router.post('/pdf', async (req: AuthRequest, res) => {
  const content = String(req.body?.content || '').trim();
  const title = String(req.body?.title || '').trim().slice(0, 120);
  if (!content) return res.status(400).json({ message: 'Nada para exportar.' });
  if (content.length > 200000)
    return res.status(400).json({ message: 'Conteúdo muito extenso para gerar PDF.' });
  try {
    const buffer = await renderPdf(content, title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="lumi-resposta.pdf"');
    res.send(buffer);
  } catch {
    res.status(500).json({ message: 'Não foi possível gerar o PDF.' });
  }
});

export default router;
