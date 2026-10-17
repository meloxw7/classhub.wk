import { useEffect, useRef, useState } from 'react';
import {
  BookMarked,
  Download,
  FileText,
  Loader2,
  Printer,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { EmptyState, Skeleton } from '../components/Feedback';

const WORK_TYPES = [
  'Trabalho Acadêmico',
  'Trabalho de Conclusão de Curso',
  'Monografia',
  'Dissertação',
  'Tese',
  'Relatório',
  'Projeto de Pesquisa',
];

const MONTHS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'maio',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];

const REF_TYPES = ['livro', 'artigo', 'site', 'tcc'];

const REF_LABELS: Record<string, string> = {
  livro: 'Livro',
  artigo: 'Artigo de revista',
  site: 'Site / página web',
  tcc: 'TCC / monografia',
};

interface RefField {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
}

const REF_FIELDS: Record<string, RefField[]> = {
  livro: [
    { key: 'authors', label: 'Autor(es) — SOBRENOME, Nome (separe por ;)' },
    { key: 'title', label: 'Título' },
    { key: 'subtitle', label: 'Subtítulo (opcional)' },
    { key: 'edition', label: 'Edição (opcional)', placeholder: '2' },
    { key: 'city', label: 'Cidade' },
    { key: 'publisher', label: 'Editora' },
    { key: 'year', label: 'Ano', placeholder: '2024' },
  ],
  artigo: [
    { key: 'authors', label: 'Autor(es) — SOBRENOME, Nome (separe por ;)' },
    { key: 'title', label: 'Título do artigo' },
    { key: 'journal', label: 'Nome da revista' },
    { key: 'volume', label: 'Volume (opcional)' },
    { key: 'number', label: 'Número (opcional)' },
    { key: 'pages', label: 'Páginas (ex.: 10-25)' },
    { key: 'city', label: 'Cidade (opcional)' },
    { key: 'year', label: 'Ano' },
  ],
  site: [
    { key: 'authors', label: 'Autor ou organização (opcional)' },
    { key: 'title', label: 'Título' },
    { key: 'year', label: 'Ano (opcional)' },
    { key: 'url', label: 'URL', placeholder: 'https://...' },
    { key: 'access', label: 'Data de acesso', type: 'date' },
  ],
  tcc: [
    { key: 'authors', label: 'Autor(es) — SOBRENOME, Nome (separe por ;)' },
    { key: 'title', label: 'Título' },
    {
      key: 'kind',
      label: 'Tipo',
      placeholder: 'Trabalho de Conclusão de Curso',
    },
    { key: 'course', label: 'Curso (opcional)' },
    { key: 'institution', label: 'Instituição' },
    { key: 'city', label: 'Cidade' },
    { key: 'year', label: 'Ano' },
  ],
};

function formatAccess(value: string) {
  if (!value) return '';

  const [y, m, d] = value.split('-');

  if (!y || !m || !d) return value;

  return `${d} ${MONTHS[Number(m) - 1] || m} ${y}`;
}

function buildReference(type: string, f: Record<string, string>) {
  const v = (k: string) => (f[k] || '').trim();
  const authors = v('authors').replace(/;\s*$/, '');

  if (type === 'livro') {
    if (!authors || !v('title') || !v('city') || !v('publisher') || !v('year')) return '';

    const parts = [`${authors}. ${v('title')}${v('subtitle') ? `: ${v('subtitle')}` : ''}.`];

    if (v('edition')) parts.push(`${v('edition')} ed.`);

    parts.push(`${v('city')}: ${v('publisher')}, ${v('year')}.`);

    return parts.join(' ');
  }

  if (type === 'artigo') {
    if (!authors || !v('title') || !v('journal') || !v('year')) return '';

    const details = [
      v('city') ? `${v('city')}, ` : '',
      v('volume') ? `v. ${v('volume')}, ` : '',
      v('number') ? `n. ${v('number')}, ` : '',
      v('pages') ? `p. ${v('pages')}, ` : '',
    ].join('');

    return `${authors}. ${v('title')}. ${v('journal')}, ${details}${v('year')}.`;
  }

  if (type === 'site') {
    if (!v('title') || !v('url') || !v('access')) return '';

    const head = authors ? `${authors}. ${v('title')}.` : `${v('title')}.`;

    return `${head} ${v('year') ? `${v('year')}. ` : ''}Disponível em: ${v('url')}. Acesso em: ${formatAccess(v('access'))}.`;
  }

  if (!authors || !v('title') || !v('institution') || !v('city') || !v('year')) return '';

  return `${authors}. ${v('title')}. ${v('city')}: ${v('institution')}, ${v('year')}. ${v('kind') || 'Trabalho de Conclusão de Curso'}${v('course') ? ` (${v('course')})` : ''}.`;
}

function slugify(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'trabalho'
  );
}

function imgSrc(img: any) {
  const mime = img?.ext === 'jpg' || img?.ext === 'jpeg' ? 'jpeg' : img?.ext || 'png';

  return `data:image/${mime};base64,${img.data}`;
}

function esc(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;');
}

export default function Abnt() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'converter' | 'referencias'>('converter');

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [converting, setConverting] = useState(false);
  const [includeRefs, setIncludeRefs] = useState(true);

  const [cover, setCover] = useState({
    institution: '',
    author: user?.name || '',
    title: '',
    workType: WORK_TYPES[0],
    course: '',
    city: '',
    year: String(new Date().getFullYear()),
    advisor: '',
  });

  const [rtype, setRtype] = useState('livro');
  const [rform, setRform] = useState<Record<string, string>>({});
  const [rlist, setRlist] = useState<any[]>([]);
  const [savingRef, setSavingRef] = useState(false);
  const [refsLoading, setRefsLoading] = useState(true);

  const referencePreview = buildReference(rtype, rform);

  async function loadRefs() {
    try {
      const response = await api.get('/abnt/references');

      setRlist(response.data);
    } catch (error) {
      console.error('Erro ao carregar referências:', error);
    } finally {
      setRefsLoading(false);
    }
  }

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    setRform({});
  }, [rtype]);

  async function convert() {
    if (!file) {
      toast.error('Selecione um arquivo .docx, .pdf ou .txt.');
      return;
    }

    setConverting(true);

    try {
      const formData = new FormData();

      formData.append('file', file);

      const response = await api.post('/abnt/convert', formData);

      setSections(response.data.sections);

      const detected = response.data.detectedCover || {};

      setCover((current) => ({
        ...current,
        institution: detected.institution || current.institution,
        author: detected.author || current.author,
        title: detected.title || current.title || file.name.replace(/\.[^.]+$/, ''),
        course: detected.course || current.course,
        city: detected.city || current.city,
        year: detected.year || current.year,
        advisor: detected.advisor || current.advisor,
      }));

      toast.success(
        response.data.detectedCover
          ? `Texto extraído (${response.data.sections.length} blocos). Capa original detectada e usada para preencher o formulário.`
          : `Texto extraído (${response.data.sections.length} blocos).`
      );
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível converter o arquivo.');
    } finally {
      setConverting(false);
    }
  }

  async function downloadDocx() {
    if (!sections.length) {
      toast.error('Envie e converta um documento primeiro.');
      return;
    }

    try {
      const response = await api.post(
        '/abnt/export',
        {
          cover,
          sections,
          references: includeRefs ? rlist.map((item) => item.formatted) : [],
        },
        { responseType: 'blob' }
      );

      const url = URL.createObjectURL(response.data);

      const link = document.createElement('a');

      link.href = url;
      link.download = `${slugify(cover.title)}-abnt.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      toast.success('Documento ABNT (.docx) baixado.');
    } catch (error: any) {
      let message = 'Não foi possível gerar o DOCX.';

      if (error.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await error.response.data.text());
          message = parsed?.message || message;
        } catch {}
      } else {
        message = error.response?.data?.message || message;
      }

      toast.error(message);
    }
  }

  function printPdf() {
    if (!sections.length) {
      toast.error('Envie e converta um documento primeiro.');
      return;
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) return;

    const refs = includeRefs
      ? [...rlist].map((item) => item.formatted).sort((a: string, b: string) => a.localeCompare(b))
      : [];

    const headings = sections.filter((section: any) => section.level >= 1);

    printWindow.document.write(`
      <html>
        <head>
          <title>${esc(cover.title || 'Trabalho ABNT')}</title>
          <style>
            @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
            body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
            p { margin: 0; text-align: justify; text-indent: 1.25cm; }
            h1, h2, h3 { margin: 12pt 0 6pt; text-transform: uppercase; text-align: left; text-indent: 0; }
            .c { text-align: center; text-indent: 0; }
            .b { font-weight: bold; }
            .pb { page-break-after: always; }
            .capa { page-break-after: always; text-align: center; text-indent: 0; }
            .refs { page-break-before: always; }
            .ref { margin: 0 0 12pt; text-indent: 0; text-align: left; line-height: 1; }
            .sum { margin: 0 0 6pt; text-indent: 0; text-align: left; }
            img { max-width: 100%; display: block; margin: 6pt auto; page-break-inside: avoid; }
          </style>
        </head>
        <body>
          <div class="capa">
            ${cover.institution ? `<div><b>${esc(cover.institution.toUpperCase())}</b></div>` : ''}
            ${cover.author ? `<div style="margin-top:2.5cm">${esc(cover.author)}</div>` : ''}
            ${cover.title ? `<div style="margin-top:2.5cm"><b>${esc(cover.title.toUpperCase())}</b></div>` : ''}
            <div style="margin-top:2.5cm">
              ${esc([cover.workType, cover.course ? `apresentado como requisito parcial do curso de ${cover.course}` : '', cover.advisor ? `Orientador(a): ${cover.advisor}` : ''].filter(Boolean).join(' — '))}
            </div>
            <div style="margin-top:4cm">${esc([cover.city, cover.year].filter(Boolean).join(' — '))}</div>
          </div>

          ${
            headings.length
              ? `<div><div class="c b">SUMÁRIO</div>${headings
                  .map(
                    (section: any) =>
                      `<p class="sum" style="margin-left:${(Math.min(section.level, 3) - 1) * 0.5}cm">${esc(section.text)}</p>`
                  )
                  .join('')}<div class="pb"></div></div>`
              : ''
          }

          ${sections
            .map((section: any) => {
              const images = (section.images || [])
                .map((img: any) => `<img src="${imgSrc(img)}" alt="" />`)
                .join('');

              return section.level
                ? `<h${Math.min(section.level, 3)}>${esc(section.text)}</h${Math.min(section.level, 3)}>${images}`
                : `<p>${esc(section.text)}</p>${images}`;
            })
            .join('\n')}

          ${
            refs.length
              ? `<div class="refs"><div class="c"><b>REFERÊNCIAS</b></div>${refs
                  .map((ref) => `<p class="ref">${esc(ref)}</p>`)
                  .join('')}</div>`
              : ''
          }

          <script>window.print()</script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  async function saveReference() {
    if (!referencePreview) {
      toast.error('Preencha os campos obrigatórios da referência.');
      return;
    }

    setSavingRef(true);

    try {
      await api.post('/abnt/references', {
        type: rtype,
        data: rform,
        formatted: referencePreview,
      });

      setRform({});

      await loadRefs();

      toast.success('Referência salva.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível salvar a referência.');
    } finally {
      setSavingRef(false);
    }
  }

  async function removeReference(item: any) {
    const ok = await confirm({
      title: 'Excluir referência?',
      text: item.formatted,
      confirmLabel: 'Excluir',
      danger: true,
    });

    if (!ok) return;

    try {
      await api.delete(`/abnt/references/${item.id}`);

      await loadRefs();

      toast.success('Referência excluída.');
    } catch (error) {
      console.error('Erro ao excluir referência:', error);
      toast.error('Não foi possível excluir a referência.');
    }
  }

  return (
    <div>
      <div className="mb-7">
        <p className="text-violet-600 font-semibold">Ferramentas</p>

        <h2 className="section-title mt-1">Conversor ABNT</h2>

        <p className="muted mt-2">
          Envie um documento e gere o trabalho formatado nas normas ABNT (NBR 14724) com referências
          NBR 6023.
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          className={tab === 'converter' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('converter')}
        >
          <FileText size={16} />
          Converter documento
        </button>

        <button
          className={tab === 'referencias' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setTab('referencias')}
        >
          <BookMarked size={16} />
          Referências
        </button>
      </div>

      {tab === 'converter' && (
        <>
          <div className="card p-5">
            <h3 className="font-bold mb-3">1. Enviar documento</h3>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt,.md"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            {file ? (
              <div className="flex items-center gap-3 rounded-2xl border border-violet-200 dark:border-violet-900 bg-violet-50/60 dark:bg-violet-950/30 p-4 mb-3">
                <span className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 shrink-0">
                  <FileText size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-auto p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition shrink-0"
                  title="Remover arquivo"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) setFile(dropped);
                }}
                className={`w-full rounded-2xl border-2 border-dashed p-8 mb-3 text-center transition-all duration-200 group ${
                  dragging
                    ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-950/40 scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/40 dark:hover:bg-violet-950/20'
                }`}
              >
                <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                  <Upload size={20} />
                </span>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-3">
                  Clique para escolher
                  <span className="muted font-normal"> ou arraste o arquivo aqui</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">.docx, .pdf, .txt ou .md — máx. 50 MB</p>
              </button>
            )}

            <button className="btn-primary" onClick={convert} disabled={converting || !file}>
              {converting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Convertendo...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Converter
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 mt-2">
              Conversão completa: caixas de texto (capas), tabelas e imagens do original são
              preservadas. O sumário é gerado automaticamente — os números de página corretos
              aparecem ao abrir o .docx no Word. A capa original é detectada e pré-preenche o
              formulário.
            </p>
          </div>

          {!!sections.length && (
            <>
              <div className="card p-5 mt-5">
                <h3 className="font-bold mb-3">2. Dados da capa (NBR 14724)</h3>

                <div className="grid md:grid-cols-2 gap-2">
                  <input
                    className="input"
                    placeholder="Instituição (ex.: Universidade Federal)"
                    value={cover.institution}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        institution: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Autor"
                    value={cover.author}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        author: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Título do trabalho"
                    value={cover.title}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        title: e.target.value,
                      })
                    }
                  />

                  <select
                    className="input"
                    value={cover.workType}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        workType: e.target.value,
                      })
                    }
                  >
                    {WORK_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>

                  <input
                    className="input"
                    placeholder="Curso"
                    value={cover.course}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        course: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Orientador(a)"
                    value={cover.advisor}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        advisor: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Cidade"
                    value={cover.city}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        city: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Ano"
                    value={cover.year}
                    onChange={(e) =>
                      setCover({
                        ...cover,
                        year: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="card p-5 mt-5">
                <h3 className="font-bold mb-3">3. Exportação</h3>

                <label className="flex items-center gap-2 text-sm mb-4">
                  <input
                    type="checkbox"
                    checked={includeRefs}
                    onChange={(e) => setIncludeRefs(e.target.checked)}
                  />
                  Incluir minhas referências na seção REFERÊNCIAS ({rlist.length} salva(s), ordem
                  alfabética)
                </label>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" onClick={downloadDocx}>
                    <Download size={16} />
                    Baixar .docx
                  </button>

                  <button className="btn-secondary" onClick={printPdf}>
                    <Printer size={16} />
                    Exportar / imprimir PDF
                  </button>
                </div>
              </div>

              <div className="card p-5 mt-5">
                <h3 className="font-bold mb-4">Pré-visualização</h3>

                <div
                  style={{
                    fontFamily: "'Times New Roman', serif",
                    fontSize: '12pt',
                    lineHeight: 1.5,
                    border: '1px dashed #cbd5e1',
                    borderRadius: 12,
                    padding: '24px 16px 16px 24px',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    {cover.institution && <b>{cover.institution.toUpperCase()}</b>}

                    {cover.author && <p style={{ marginTop: 24 }}>{cover.author}</p>}

                    {cover.title && (
                      <p style={{ marginTop: 24 }}>
                        <b>{cover.title.toUpperCase()}</b>
                      </p>
                    )}

                    <p style={{ marginTop: 24 }}>
                      {[
                        cover.workType,
                        cover.course
                          ? `apresentado como requisito parcial do curso de ${cover.course}`
                          : '',
                        cover.advisor ? `Orientador(a): ${cover.advisor}` : '',
                      ]
                        .filter(Boolean)
                        .join(' — ')}
                    </p>

                    <p style={{ marginTop: 48 }}>
                      {[cover.city, cover.year].filter(Boolean).join(' — ')}
                    </p>
                  </div>

                  <hr style={{ margin: '24px 0' }} />

                  {sections.some((section: any) => section.level >= 1) && (
                    <div
                      style={{
                        marginBottom: 24,
                      }}
                    >
                      <p
                        style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          marginBottom: 12,
                        }}
                      >
                        SUMÁRIO
                      </p>

                      {sections
                        .filter((section: any) => section.level >= 1)
                        .map((section: any, index: number) => (
                          <p
                            key={`sum-${index}`}
                            style={{
                              textAlign: 'left',
                              marginBottom: 6,
                              marginLeft: `${(Math.min(section.level, 3) - 1) * 0.5}cm`,
                            }}
                          >
                            {section.text}
                          </p>
                        ))}

                      <hr style={{ margin: '16px 0' }} />
                    </div>
                  )}

                  {sections.map((section, index) => (
                    <div key={index}>
                      {section.level ? (
                        <p
                          style={{
                            marginTop: 12,
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            textAlign: 'left',
                          }}
                        >
                          {section.text}
                        </p>
                      ) : (
                        <p
                          style={{
                            textAlign: 'justify',
                            textIndent: '1.25cm',
                            marginBottom: 6,
                          }}
                        >
                          {section.text}
                        </p>
                      )}

                      {(section.images || []).map((img: any, imgIndex: number) => (
                        <img
                          key={imgIndex}
                          src={imgSrc(img)}
                          alt=""
                          style={{
                            maxWidth: '100%',
                            display: 'block',
                            margin: '8pt auto',
                          }}
                        />
                      ))}
                    </div>
                  ))}

                  {includeRefs && rlist.length > 0 && (
                    <>
                      <p
                        style={{
                          marginTop: 24,
                          textAlign: 'center',
                          fontWeight: 'bold',
                        }}
                      >
                        REFERÊNCIAS
                      </p>

                      {[...rlist]
                        .sort((a: any, b: any) => a.formatted.localeCompare(b.formatted))
                        .map((item: any) => (
                          <p
                            key={item.id}
                            style={{
                              textAlign: 'left',
                              lineHeight: 1,
                              marginBottom: 12,
                            }}
                          >
                            {item.formatted}
                          </p>
                        ))}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'referencias' && (
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <div className="card p-5">
            <h3 className="font-bold mb-3">Nova referência (NBR 6023)</h3>

            <select className="input mb-3" value={rtype} onChange={(e) => setRtype(e.target.value)}>
              {REF_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REF_LABELS[type]}
                </option>
              ))}
            </select>

            <div className="grid md:grid-cols-2 gap-2">
              {REF_FIELDS[rtype].map((field) => (
                <input
                  key={field.key}
                  className="input"
                  placeholder={field.label}
                  type={field.type || 'text'}
                  value={rform[field.key] || ''}
                  onChange={(e) =>
                    setRform({
                      ...rform,
                      [field.key]: e.target.value,
                    })
                  }
                />
              ))}
            </div>

            {referencePreview && (
              <div className="mt-3 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">Pré-visualização</p>

                <p className="text-sm">{referencePreview}</p>
              </div>
            )}

            <button className="btn-primary mt-4" onClick={saveReference} disabled={savingRef}>
              {savingRef ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Salvar referência
                </>
              )}
            </button>
          </div>

          <div className="card p-5">
            <h3 className="font-bold mb-3">Minhas referências ({rlist.length})</h3>

            <div className="space-y-2">
              {refsLoading &&
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}

              {!refsLoading &&
                rlist.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 flex justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="chip">{REF_LABELS[item.type] || item.type}</span>

                      <p className="text-sm mt-2 break-words">{item.formatted}</p>
                    </div>

                    <button
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      title="Excluir"
                      onClick={() => removeReference(item)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}

              {!refsLoading && !rlist.length && (
                <EmptyState
                  icon={BookMarked}
                  title="Nenhuma referência salva"
                  text="Gere sua primeira referência ABNT no formulário ao lado."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
