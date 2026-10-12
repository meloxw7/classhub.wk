import { Router } from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { PDFParse } from 'pdf-parse';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
  HeadingLevel,
  TableOfContents,
  ImageRun,
} from 'docx';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
const router = Router();
router.use(auth);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const AMP = String.fromCharCode(38);
const xmlDecode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .split(AMP + 'quot;')
    .join('"')
    .split(AMP + 'apos;')
    .join("'")
    .split(AMP + 'lt;')
    .join('<')
    .split(AMP + 'gt;')
    .join('>')
    .split(AMP + 'amp;')
    .join(AMP);
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const HEADING_WORDS = [
  'SUMARIO',
  'REFERENCIAS',
  'INTRODUCAO',
  'METODOLOGIA',
  'CONCLUSAO',
  'CONSIDERACOES FINAIS',
  'RESUMO',
  'ABSTRACT',
  'DESENVOLVIMENTO',
  'FUNDAMENTACAO TEORICA',
  'RESULTADOS',
  'ANALISE E DISCUSSAO',
  'OBJETIVOS',
  'PROBLEMATICA',
  'JUSTIFICATIVA',
  'ANEXOS',
  'APENDICES',
  'CRONOGRAMA',
  'REFERENCIA',
];
function stripComplexToc(xml: string) {
  const ranges: [number, number][] = [];
  const re =
    /<w:fldChar[^>]*w:fldCharType="(?:begin|end)"[^>]*\/?>|<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g;
  let depth = 0,
    start = -1,
    instr = '';
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[0].includes('fldCharType')) {
      if (m[0].includes('"begin"')) {
        depth++;
        if (depth === 1) {
          start = m.index;
          instr = '';
        }
      } else {
        depth--;
        if (depth === 0 && start >= 0) {
          if (/\bTOC\b/i.test(instr)) ranges.push([start, m.index + m[0].length]);
          start = -1;
          instr = '';
        }
      }
    } else if (depth >= 1 && m[1] !== undefined) {
      instr += m[1];
    }
  }
  for (let i = ranges.length - 1; i >= 0; i--)
    xml = xml.slice(0, ranges[i][0]) + xml.slice(ranges[i][1]);
  return xml;
}
function detectCover(lines: string[]) {
  const dc: any = {
    institution: '',
    author: '',
    title: '',
    workType: '',
    course: '',
    city: '',
    year: '',
    advisor: '',
  };
  if (!lines.length) return null;
  dc.institution = lines[0] || '';
  for (const l of lines) {
    const cy = l.match(/^([\p{L}\s.'-]{2,60})\s*[-–—]\s*(\d{4})\s*$/u);
    if (cy && !dc.city) {
      dc.city = cy[1].trim();
      dc.year = cy[2];
    }
    if (/^\d{4}$/.test(l) && !dc.year) dc.year = l;
    if (/orientad/i.test(l) && !dc.advisor)
      dc.advisor = l
        .replace(/^.*?orientador[a]?\s*[:]?\s*/i, '')
        .trim()
        .replace(/\.$/, '');
    if (/apresentado|requisito|curso de/i.test(l) && !dc.workType && l.length <= 200)
      dc.workType = l;
    const course = l.match(/curso de ([\p{L}\s-]{2,60})/iu);
    if (course && !dc.course) dc.course = course[1].trim();
  }
  const rest = lines.filter(
    (l) =>
      l !== dc.institution &&
      !/orientad/i.test(l) &&
      !(dc.city && l.includes(dc.city)) &&
      !/apresentado|requisito|curso de/i.test(l)
  );
  const title = rest.slice().sort((a, b) => b.length - a.length)[0] || '';
  if (title) dc.title = title;
  const others = rest.filter((l) => l !== title);
  const author = others.find((l) => l.length <= 60 && l.split(/\s+/).length <= 5) || '';
  if (author) dc.author = author;
  return dc;
}
async function parseDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('document.xml ausente');
  let xml = await docFile.async('string');
  xml = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '');
  xml = xml.replace(/<w:fldSimple[^>]*w:instr="[^"]*TOC[^"]*"[^>]*>[\s\S]*?<\/w:fldSimple>/g, '');
  xml = stripComplexToc(xml);
  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) || '';
  const rels: Record<string, string> = {};
  const relRe = /<Relationship[^>]*\/>/g;
  let rm;
  while ((rm = relRe.exec(relsXml)) !== null) {
    const id = rm[0].match(/Id="([^"]+)"/)?.[1];
    const target = rm[0].match(/Target="([^"]+)"/)?.[1];
    if (id && target) rels[id] = target;
  }
  const mediaCache: Record<string, { ext: string; data: string } | null> = {};
  async function getMedia(rid: string) {
    const target = rels[rid];
    if (!target || !/^media\//.test(target)) return null;
    if (rid in mediaCache) return mediaCache[rid];
    const f = zip.file('word/' + target);
    let out: { ext: string; data: string } | null = null;
    if (f) {
      const ext = (target.split('.').pop() || 'png').toLowerCase();
      out = { ext, data: (await f.async('nodebuffer')).toString('base64') };
    }
    mediaCache[rid] = out;
    return out;
  }
  const sections: any[] = [];
  const pRe = /<w:p\b[^>]*\/>|<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pm;
  while ((pm = pRe.exec(xml)) !== null) {
    const c = pm[1] ?? '';
    const text = (c.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
      .map((t) => xmlDecode(t.replace(/<[^>]+>/g, '')))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    const styleRaw = c.match(/<w:pStyle[^>]*w:val="([^"]+)"/)?.[1] || '';
    const style = norm(styleRaw).toLowerCase().replace(/\s+/g, '');
    let level = 0;
    if (/^(?:toc|sumrio|sumario)\d*$/.test(style)) continue;
    const hm =
      style.match(/^(?:heading|titulo|ttulo|capitulo|secao|subtitle|subtitulo)(\d)$/) ||
      style.match(/^(\d)$/);
    if (hm) level = Math.min(Number(hm[1]), 3);
    if (level === 0 && text) {
      const numbered = text.match(/^(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+\S/);
      if (numbered) level = Math.min(numbered[1].split('.').length, 3);
      else {
        const up = norm(text)
          .toUpperCase()
          .replace(/[^A-Z0-9 ]/g, ' ')
          .trim();
        if (text.length <= 60 && HEADING_WORDS.includes(up)) level = 1;
      }
    }
    const blips = [...c.matchAll(/<a:blip[^>]*r:embed="([^"]+)"/g)].map((x) => x[1]);
    const vml = [...c.matchAll(/<v:imagedata[^>]*r:id="([^"]+)"/g)].map((x) => x[1]);
    const rids = [...new Set([...blips, ...vml])];
    const images: any[] = [];
    if (rids.length) {
      const extMatch =
        c.match(/<wp:extent[^>]*cx="(\d+)"[^>]*cy="(\d+)"/) ||
        c.match(/<a:ext[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
      const width = extMatch ? Math.max(20, Math.round(Number(extMatch[1]) / 9525)) : 400;
      const height = extMatch ? Math.max(20, Math.round(Number(extMatch[2]) / 9525)) : 300;
      for (const rid of rids) {
        const media = await getMedia(rid);
        if (media) images.push({ ...media, width, height });
      }
    }
    if (!text && !images.length) continue;
    sections.push({ level, text, images });
  }
  let detectedCover: any = null;
  let droppedCover = 0;
  const firstHeading = sections.findIndex((s) => s.level >= 1);
  if (firstHeading > 0) {
    const coverLines = sections
      .slice(0, firstHeading)
      .map((s) => s.text)
      .filter(Boolean);
    if (coverLines.length) {
      droppedCover = coverLines.length;
      detectedCover = detectCover(coverLines);
      sections.splice(0, firstHeading);
    }
  }
  return { sections, detectedCover, droppedCover };
}
router.post('/convert', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: 'Arquivo obrigatório' });
  const name = (file.originalname || '').toLowerCase();
  try {
    if (name.endsWith('.docx')) {
      let result;
      try {
        result = await parseDocx(file.buffer);
      } catch (parseError) {
        console.error('Parser docx falhou, usando mammoth:', parseError);
        const { value } = await mammoth.convertToHtml({ buffer: file.buffer });
        const sections: any[] = [];
        const re = /<(h1|h2|h3|p)[^>]*>([\s\S]*?)<\/\1>/g;
        let m;
        while ((m = re.exec(value)) !== null) {
          const t = m[2]
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (t) sections.push({ level: m[1] === 'p' ? 0 : Number(m[1][1]), text: t, images: [] });
        }
        result = { sections, detectedCover: null, droppedCover: 0 };
      }
      if (!result.sections.length)
        return res.status(400).json({ message: 'Não foi possível extrair texto deste .docx.' });
      return res.json({ source: 'DOCX', ...result });
    }
    if (name.endsWith('.pdf')) {
      let text = '';
      try {
        const parser = new PDFParse({ data: file.buffer });
        const result = await parser.getText();
        text = result.text || '';
        await parser.destroy();
      } catch (pdfError) {
        console.error('Erro ao extrair PDF:', pdfError);
        return res
          .status(400)
          .json({ message: 'Não foi possível ler este PDF. Tente enviar em .docx ou .txt.' });
      }
      if (!text.trim())
        return res
          .status(400)
          .json({
            message:
              'Não foi possível extrair texto deste PDF (possivelmente escaneado/imagem). Envie em .docx ou .txt.',
          });
      const paras: string[] = [];
      let cur = '';
      text.split(/\r?\n/).forEach((line: string) => {
        const l = line.trim();
        if (!l) {
          if (cur) paras.push(cur);
          cur = '';
        } else cur += cur ? ' ' + l : l;
      });
      if (cur) paras.push(cur);
      const sections = paras.map((t: string) => ({
        level:
          norm(t)
            .toUpperCase()
            .replace(/[^A-Z0-9 ]/g, ' ')
            .trim().length <= 5 &&
          t.length >= 5 &&
          !/[a-zà-ú]/.test(t)
            ? 1
            : HEADING_WORDS.includes(
                  norm(t)
                    .toUpperCase()
                    .replace(/[^A-Z0-9 ]/g, ' ')
                    .trim()
                )
              ? 1
              : 0,
        text: t,
        images: [],
      }));
      return res.json({ source: 'PDF', sections, detectedCover: null, droppedCover: 0 });
    }
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      const text = file.buffer.toString('utf8');
      const sections = text
        .split(/\n\s*\n/)
        .map((p) => p.replace(/[ \t]*\n[ \t]*/g, ' ').trim())
        .filter(Boolean)
        .map((t) => ({
          level: HEADING_WORDS.includes(
            norm(t)
              .toUpperCase()
              .replace(/[^A-Z0-9 ]/g, ' ')
              .trim()
          )
            ? 1
            : 0,
          text: t,
          images: [],
        }));
      if (!sections.length) return res.status(400).json({ message: 'Arquivo vazio.' });
      return res.json({ source: 'TXT', sections, detectedCover: null, droppedCover: 0 });
    }
    return res.status(400).json({ message: 'Formato não suportado. Use .docx, .pdf ou .txt.' });
  } catch (error) {
    console.error('Erro na conversão ABNT:', error);
    return res.status(400).json({ message: 'Não foi possível converter o arquivo.' });
  }
});
router.get('/references', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'SELECT * FROM abnt_references WHERE user_id=$1 ORDER BY created_at DESC',
    [req.user!.id]
  );
  res.json(r.rows);
});
router.post('/references', async (req: AuthRequest, res) => {
  const { type, data, formatted, subjectId } = req.body || {};
  if (!type || !formatted)
    return res.status(400).json({ message: 'Tipo e referência formatada são obrigatórios' });
  const r = await pool.query(
    'INSERT INTO abnt_references(user_id,subject_id,type,data,formatted) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [req.user!.id, subjectId || null, type, data || {}, formatted]
  );
  res.status(201).json(r.rows[0]);
});
router.delete('/references/:id', async (req: AuthRequest, res) => {
  const r = await pool.query('DELETE FROM abnt_references WHERE id=$1 AND user_id=$2', [
    req.params.id,
    req.user!.id,
  ]);
  if (!r.rowCount) return res.status(404).json({ message: 'Referência não encontrada' });
  res.json({ ok: true });
});
router.post('/export', async (req, res) => {
  const { cover = {}, sections = [], references = [] } = req.body || {};
  const CM = 567;
  const rp = (text: string, opts: any = {}) =>
    new TextRun({ text: String(text ?? ''), font: 'Times New Roman', size: 24, ...opts });
  const center = (text: string, opts: any = {}) =>
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { line: 360, ...(opts.spacing || {}) },
      children: [rp(text, opts.run || {})],
    });
  const coverParas: Paragraph[] = [];
  if (cover.institution)
    coverParas.push(center(String(cover.institution).toUpperCase(), { run: { bold: true } }));
  if (cover.author)
    coverParas.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 360, before: 1800 },
        children: [rp(cover.author)],
      })
    );
  if (cover.title)
    coverParas.push(
      center(String(cover.title).toUpperCase(), { run: { bold: true }, spacing: { before: 2400 } })
    );
  const bits: string[] = [];
  if (cover.workType) bits.push(String(cover.workType));
  if (cover.course) bits.push(`apresentado como requisito parcial do curso de ${cover.course}`);
  if (cover.advisor) bits.push(`Orientador(a): ${cover.advisor}`);
  if (bits.length)
    coverParas.push(
      center(bits.join(' — ').replace(/^(.)/, (c) => c.toUpperCase()) + '.', {
        spacing: { before: 2400 },
      })
    );
  if (cover.city || cover.year)
    coverParas.push(
      center(`${cover.city || ''}${cover.city && cover.year ? ' — ' : ''}${cover.year || ''}`, {
        spacing: { before: 4800 },
      })
    );
  const bodyParas: Paragraph[] = [];
  let hasHeadings = false;
  const IMG_TYPES: Record<string, 'png' | 'jpg' | 'gif' | 'bmp'> = {
    jpg: 'jpg',
    jpeg: 'jpg',
    png: 'png',
    gif: 'gif',
    bmp: 'bmp',
  };
  (sections as any[]).forEach((s) => {
    const t = String(s?.text || '').trim();
    if (s.level >= 1 && s.level <= 3) {
      if (!t) return;
      hasHeadings = true;
      const heading = ([1, 2, 3] as const).includes(s.level)
        ? s.level === 1
          ? HeadingLevel.HEADING_1
          : s.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3
        : HeadingLevel.HEADING_1;
      bodyParas.push(new Paragraph({ heading, children: [rp(t)] }));
    } else if (t) {
      bodyParas.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360 },
          indent: { firstLine: 709 },
          children: [rp(t)],
        })
      );
    }
    (s.images || []).forEach((img: any) => {
      const type = IMG_TYPES[String(img?.ext || '').toLowerCase()];
      if (!type || !img?.data) return;
      let width = Number(img.width) || 400;
      let height = Number(img.height) || 300;
      if (width > 600) {
        height = Math.round((height * 600) / width);
        width = 600;
      }
      try {
        bodyParas.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 240, after: 240 },
            children: [
              new ImageRun({
                type: type as 'png' | 'jpg' | 'gif' | 'bmp',
                data: Buffer.from(img.data, 'base64'),
                transformation: { width, height },
              }),
            ],
          })
        );
      } catch (e) {
        console.error('Imagem ignorada na exportação:', e);
      }
    });
  });
  const refParas: Paragraph[] = [];
  if (Array.isArray(references) && references.length) {
    refParas.push(center('REFERÊNCIAS', { run: { bold: true } }));
    [...references]
      .sort((a, b) => String(a).localeCompare(String(b)))
      .forEach((r) =>
        refParas.push(
          new Paragraph({ spacing: { line: 240, after: 240 }, children: [rp(String(r))] })
        )
      );
  }
  const children: (Paragraph | TableOfContents)[] = [
    ...coverParas,
    new Paragraph({ children: [new PageBreak()] }),
  ];
  if (hasHeadings) {
    children.push(
      center('SUMÁRIO', { run: { bold: true } }),
      new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-3' }),
      new Paragraph({ children: [new PageBreak()] })
    );
  }
  children.push(...bodyParas);
  if (refParas.length) {
    children.push(new Paragraph({ children: [new PageBreak()] }), ...refParas);
  }
  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: 24 },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, allCaps: true, size: 24, font: 'Times New Roman' },
          paragraph: {
            spacing: { line: 360, before: 240, after: 120 },
            alignment: AlignmentType.LEFT,
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 24, font: 'Times New Roman' },
          paragraph: {
            spacing: { line: 360, before: 240, after: 120 },
            alignment: AlignmentType.LEFT,
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 24, font: 'Times New Roman' },
          paragraph: {
            spacing: { line: 360, before: 240, after: 120 },
            alignment: AlignmentType.LEFT,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 3 * CM, right: 2 * CM, bottom: 2 * CM, left: 3 * CM },
          },
        },
        children,
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  const fn =
    String(cover.title || 'trabalho')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'trabalho';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fn}-abnt.docx"`);
  res.end(buf);
});
export default router;
