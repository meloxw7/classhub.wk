import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  FileDown,
  FileText,
  Paperclip,
  Send,
  Sparkles,
  Square,
  UserRound,
  X,
} from 'lucide-react';
import { apiBaseURL } from '../lib/api';
import { useAuth } from '../lib/auth';

type Message = {
  role: 'user' | 'model';
  content: string;
  files?: { name: string; size: number }[];
};

const SUGGESTIONS = [
  'Explique um tópico difícil da minha disciplina',
  'Crie um plano de estudos para esta semana',
  'Simule uma prova com 5 questões',
  'Revise meu resumo e dê feedback',
];

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,.md,.docx';

async function streamTutor(
  messages: Message[],
  files: File[] | null,
  onDelta: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const token = localStorage.getItem('classhub_token');
  let body: BodyInit;
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (files?.length) {
    const form = new FormData();
    form.append('data', JSON.stringify({ messages }));
    for (const file of files) form.append('files', file);
    body = form;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ messages });
  }
  const res = await fetch(`${apiBaseURL}/tutor/chat`, { method: 'POST', headers, body, signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: '' }));
    throw new Error(data.message || 'Não foi possível falar com o tutor.');
  }
  const reader = res.body!.getReader();
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
        if (json.error) throw new Error(json.error);
        if (json.text) onDelta(json.text);
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.startsWith('Unexpected')) throw e;
      }
    }
  }
}

function renderMarkdown(text: string) {
  const blocks = text.split(/```/);
  return blocks.map((block, blockIndex) => {
    if (blockIndex % 2 === 1) {
      const [maybeLang, ...rest] = block.split('\n');
      const lang = /^[a-z]+$/i.test(maybeLang.trim()) ? maybeLang.trim() : '';
      const code = lang ? rest.join('\n') : block;
      return (
        <pre
          key={blockIndex}
          className="my-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-xs overflow-x-auto"
        >
          {lang && <span className="eyebrow block mb-1">{lang}</span>}
          <code className="whitespace-pre text-slate-700 dark:text-slate-200">{code}</code>
        </pre>
      );
    }
    const lines = block.split('\n');
    return (
      <span key={blockIndex}>
        {lines.map((line, lineIndex) => {
          const bullet = line.match(/^\s*[-*]\s+(.*)$/);
          const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
          const heading = line.match(/^#{1,3}\s+(.*)$/);
          let content: React.ReactNode = boldParts(line);
          if (bullet) {
            content = (
              <span className="flex gap-2">
                <span className="text-violet-500 shrink-0 mt-0.5">•</span>
                <span>{boldParts(bullet[1])}</span>
              </span>
            );
          } else if (numbered) {
            content = (
              <span className="flex gap-2">
                <span className="text-violet-500 shrink-0 mt-0.5">›</span>
                <span>{boldParts(numbered[1])}</span>
              </span>
            );
          } else if (heading) {
            content = <span className="font-bold">{boldParts(heading[1])}</span>;
          }
          return (
            <span key={lineIndex} className="block min-h-[0.6em]">
              {content}
            </span>
          );
        })}
      </span>
    );
  });
}

function boldParts(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={index} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[0.85em] text-violet-700 dark:text-violet-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&' + 'amp;')
    .replace(/</g, '&' + 'lt;')
    .replace(/>/g, '&' + 'gt;')
    .replace(/"/g, '&' + 'quot;');
}

function mdToHtml(text: string) {
  const blocks = text.split(/```/);
  return blocks
    .map((block, i) => {
      if (i % 2 === 1) {
        const lines = block.split('\n');
        const lang = /^[a-z]+$/i.test(lines[0].trim()) ? lines.shift() : '';
        return `<pre>${lang ? `<div class="lang">${esc(String(lang))}</div>` : ''}${esc(lines.join('\n'))}</pre>`;
      }
      return block
        .split('\n')
        .map((line) => {
          const h = line.match(/^#{1,3}\s+(.*)$/);
          const b = line.match(/^\s*[-*]\s+(.*)$/);
          const n = line.match(/^\s*\d+\.\s+(.*)$/);
          const inline = (s: string) =>
            esc(s)
              .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
              .replace(/`([^`]+)`/g, '<code>$1</code>');
          if (h) {
            const level = Math.min(h[1] ? (line.match(/^#+/) || ['#'])[0].length : 1, 3);
            return `<h${level}>${inline(h[1])}</h${level}>`;
          }
          if (b) return `<li>${inline(b[1])}</li>`;
          if (n) return `<li>${inline(n[1])}</li>`;
          return line.trim() ? `<p>${inline(line)}</p>` : '';
        })
        .join('\n')
        .replace(/(<li>[\s\S]*?<\/li>)(\s*(?=<li>))?/g, '$1');
    })
    .join('\n')
    .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');
}

function exportPdf(content: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>ClassHub — Tutor IA</title>
        <style>
          @page { size: A4; margin: 2.2cm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #101014; line-height: 1.65; font-size: 11pt; }
          header { border-bottom: 3px solid #7c3aed; padding-bottom: 10pt; margin-bottom: 20pt; display: flex; align-items: center; gap: 10pt; }
          .logo { width: 26pt; height: 26pt; border-radius: 7pt; background: #7c3aed; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 13pt; }
          .brand { font-size: 15pt; font-weight: 800; }
          .brand span { color: #7c3aed; }
          .date { margin-left: auto; color: #94a3b8; font-size: 8.5pt; }
          h1, h2, h3 { margin: 14pt 0 6pt; color: #101014; }
          p { margin: 6pt 0; text-align: justify; }
          ul { margin: 6pt 0 6pt 18pt; }
          li { margin: 3pt 0; }
          code { background: #ede9fe; color: #5b21b6; padding: 1pt 4pt; border-radius: 4pt; font-size: 10pt; }
          pre { background: #f5f3ff; border: 1pt solid #ddd6fe; border-radius: 8pt; padding: 10pt; margin: 8pt 0; white-space: pre-wrap; font-size: 9.5pt; }
          pre .lang { color: #7c3aed; font-weight: 700; font-size: 8pt; margin-bottom: 4pt; text-transform: uppercase; }
          b { color: #101014; }
        </style>
      </head>
      <body>
        <header>
          <div class="logo">C</div>
          <div class="brand">Class<span>Hub</span> — Tutor IA</div>
          <div class="date">${new Date().toLocaleString('pt-BR')}</div>
        </header>
        ${mdToHtml(content)}
        <script>window.print()</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export default function Tutor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, attachments]);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const accepted = Array.from(list).filter((f) => /\.(pdf|png|jpe?g|txt|md|docx)$/i.test(f.name));
    setAttachments((current) => [...current, ...accepted].slice(0, 3));
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setThinking(false);
    setMessages((current) => {
      const copy = [...current];
      const last = copy[copy.length - 1];
      if (last?.role === 'model' && !last.content) copy.pop();
      return copy;
    });
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && !attachments.length) || streaming) return;
    setError('');
    setInput('');
    const files = attachments;
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const history = [
      ...messages,
      {
        role: 'user' as const,
        content: content || 'Analise os arquivos anexados.',
        files: files.map((f) => ({ name: f.name, size: f.size })),
      },
    ];
    setMessages([...history, { role: 'model', content: '' }]);
    setStreaming(true);
    setThinking(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamTutor(
        history,
        files,
        (delta) => {
          setThinking(false);
          setMessages((current) => {
            const copy = [...current];
            copy[copy.length - 1] = {
              role: 'model',
              content: copy[copy.length - 1].content + delta,
            };
            return copy;
          });
        },
        controller.signal
      );
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Erro ao conversar com o tutor.');
        setMessages((current) => {
          const copy = [...current];
          const last = copy[copy.length - 1];
          if (last?.role === 'model' && !last.content) copy.pop();
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      setThinking(false);
      abortRef.current = null;
    }
  }

  function copyMessage(index: number) {
    const message = messages[index];
    if (!message) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(index);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <span className="relative shrink-0">
          <span className="float-soft absolute -inset-2 bg-gradient-to-br from-violet-300/60 to-fuchsia-300/50 dark:from-violet-700/40 dark:to-fuchsia-700/30 rounded-full blur-lg" />
          <span className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 grid place-items-center text-white shadow-lg shadow-violet-500/25">
            <Sparkles size={22} />
          </span>
        </span>
        <div>
          <p className="eyebrow">Ferramentas</p>
          <h2 className="section-title mt-0.5">Tutor IA</h2>
          <p className="muted mt-1">
            Tire dúvidas, revise textos e planeje estudos — com contexto das suas disciplinas.
          </p>
        </div>
      </div>

      <div className="card overflow-hidden flex flex-col h-[calc(100vh-16rem)] min-h-[26rem]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <span className="relative mb-4">
                <span className="float-soft absolute -inset-4 bg-gradient-to-br from-violet-200/70 to-fuchsia-200/50 dark:from-violet-800/40 dark:to-fuchsia-800/30 rounded-full blur-xl" />
                <span className="relative w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 grid place-items-center text-white shadow-xl shadow-violet-500/25">
                  <Sparkles size={28} />
                </span>
              </span>
              <h3 className="font-bold text-lg">
                Olá, {user?.name?.split(' ')[0]}! Sou o seu tutor.
              </h3>
              <p className="muted mt-1 max-w-md">
                Pergunte qualquer coisa sobre suas disciplinas — eu explico, crio exercícios e
                ajudo a revisar. Anexe PDFs e imagens, e exporte minhas respostas em PDF.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-lg">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="chip chip-brand hover:bg-violet-100 dark:hover:bg-violet-900 transition cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) =>
            message.role === 'user' ? (
              <div key={index} className="flex justify-end">
                <div className="max-w-[85%] md:max-w-[70%] flex items-end gap-2 flex-row-reverse">
                  <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 grid place-items-center shrink-0 text-slate-600 dark:text-slate-300">
                    <UserRound size={15} />
                  </span>
                  <div>
                    {!!message.files?.length && (
                      <div className="flex flex-wrap gap-1.5 justify-end mb-1.5">
                        {message.files.map((f) => (
                          <span
                            key={f.name}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-900 rounded-full px-2 py-0.5"
                          >
                            <FileText size={11} />
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="bg-violet-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap shadow-md shadow-violet-600/15">
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div key={index} className="flex gap-2">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 grid place-items-center shrink-0 text-white shadow-md shadow-violet-500/20">
                  <Sparkles size={15} />
                </span>
                <div className="max-w-[85%] md:max-w-[70%] group">
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200">
                    {message.content ? (
                      renderMarkdown(message.content)
                    ) : thinking ? (
                      <span className="flex gap-1 py-1">
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                      </span>
                    ) : null}
                    {streaming && message.content && index === messages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 ml-0.5 bg-violet-500 rounded-sm animate-pulse align-text-bottom" />
                    )}
                  </div>
                  {message.content && index === messages.length - 1 && !streaming && (
                    <div className="mt-1 ml-1 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => copyMessage(index)}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition"
                      >
                        {copied === index ? <Check size={11} /> : <Copy size={11} />}
                        {copied === index ? 'Copiado!' : 'Copiar'}
                      </button>
                      <button
                        onClick={() => exportPdf(message.content)}
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition"
                      >
                        <FileDown size={11} />
                        Exportar PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {error && (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-semibold px-3 py-1.5">
                <X size={13} />
                {error}
              </span>
            </div>
          )}
        </div>

        {!!attachments.length && (
          <div className="flex flex-wrap gap-2 px-3 md:px-4 pt-3">
            {attachments.map((file, index) => (
              <span
                key={file.name + index}
                className="inline-flex items-center gap-2 bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-900 text-violet-700 dark:text-violet-300 rounded-full pl-2.5 pr-1.5 py-1 text-xs font-semibold"
              >
                <FileText size={12} />
                <span className="max-w-40 truncate">{file.name}</span>
                <span className="text-violet-400 font-normal">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="p-1 rounded-full hover:bg-violet-100 dark:hover:bg-violet-900 transition"
                  title="Remover anexo"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <form
          onSubmit={submit}
          className="border-t border-slate-100 dark:border-slate-800 p-3 md:p-4 flex gap-2 items-end bg-white dark:bg-[#14141a]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary !px-3 shrink-0"
            title="Anexar arquivos (PDF, imagem, texto)"
            disabled={streaming}
          >
            <Paperclip size={16} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Pergunte algo ao tutor..."
            rows={1}
            className="input resize-none max-h-32 py-2.5"
            style={{ height: 'auto' }}
          />
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="btn-secondary !px-3 shrink-0"
              title="Parar geração"
            >
              <Square size={16} className="text-red-500" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() && !attachments.length}
              className="btn-primary !px-3.5 shrink-0"
              title="Enviar"
            >
              <Send size={16} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
