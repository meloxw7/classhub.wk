import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BookMarked,
  CalendarDays,
  ClipboardList,
  CornerDownLeft,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  Search as SearchIcon,
  UserRound,
  Bell,
  Users,
  AtSign,
  Mail,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';

type Item = {
  id: string;
  label: string;
  hint: string;
  to: string;
  icon: typeof BookOpen;
};

const PAGES: Item[] = [
  { id: 'p-dash', label: 'Dashboard', hint: 'Página', to: '/', icon: LayoutDashboard },
  { id: 'p-disc', label: 'Disciplinas', hint: 'Página', to: '/disciplinas', icon: BookOpen },
  { id: 'p-mat', label: 'Materiais', hint: 'Página', to: '/materiais', icon: FileText },
  { id: 'p-notas', label: 'Bloco de notas', hint: 'Página', to: '/notas', icon: NotebookPen },
  { id: 'p-agenda', label: 'Agenda', hint: 'Página', to: '/agenda', icon: CalendarDays },
  { id: 'p-trab', label: 'Trabalhos', hint: 'Página', to: '/trabalhos', icon: ClipboardList },
  { id: 'p-boletim', label: 'Boletim', hint: 'Página', to: '/boletim', icon: GraduationCap },
  { id: 'p-social', label: 'Comunidade', hint: 'Página', to: '/social', icon: AtSign },
  { id: 'p-mensagens', label: 'Mensagens', hint: 'Página', to: '/mensagens', icon: Mail },
  { id: 'p-flashcards', label: 'Flashcards', hint: 'Página', to: '/flashcards', icon: Layers },
  { id: 'p-salas', label: 'Salas de estudo', hint: 'Página', to: '/salas', icon: Users },
  { id: 'p-chat', label: 'Chat da turma', hint: 'Página', to: '/chat', icon: MessagesSquare },
  { id: 'p-abnt', label: 'Conversor ABNT', hint: 'Página', to: '/abnt', icon: BookMarked },
  { id: 'p-notif', label: 'Notificações', hint: 'Página', to: '/notificacoes', icon: Bell },
  { id: 'p-perfil', label: 'Meu perfil', hint: 'Página', to: '/perfil', icon: UserRound },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [results, setResults] = useState<any | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === 'Escape') setOpen(false);
    }
    function onOpenRequest() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('classhub:open-command', onOpenRequest);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('classhub:open-command', onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults(null);
      setActive(0);
      return;
    }
    inputRef.current?.focus();
    if (!subjects.length) {
      api
        .get('/subjects')
        .then((r) => setSubjects(r.data))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .get('/search', { params: { q: query.trim() } })
        .then((r) => setResults(r.data))
        .catch(() => setResults(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const subjectItems: Item[] = subjects.map((s) => ({
      id: `s-${s.id}`,
      label: s.name,
      hint: 'Disciplina',
      to: `/disciplinas/${s.id}`,
      icon: BookOpen,
    }));
    if (!q) return [...PAGES.slice(0, 8), ...subjectItems.slice(0, 4)];
    const filtered = [
      ...PAGES.filter((p) => p.label.toLowerCase().includes(q)),
      ...subjectItems.filter((s) => s.label.toLowerCase().includes(q)),
    ];
    if (results) {
      const map = (arr: any[], prefix: string, icon: typeof BookOpen, to: (x: any) => string, hint: string) =>
        (arr || []).map((x) => ({
          id: `${prefix}-${x.id}`,
          label: x.title || x.question || x.name,
          hint,
          to: to(x),
          icon,
        }));
      filtered.push(
        ...map(results.materials, 'm', FileText, (x) => `/disciplinas/${x.subject_id}`, 'Material'),
        ...map(results.events, 'e', CalendarDays, () => '/agenda', 'Evento'),
        ...map(results.notices, 'n', Bell, () => '/disciplinas', 'Aviso')
      );
    }
    return filtered.slice(0, 12);
  }, [query, subjects, results]);

  useEffect(() => {
    setActive(0);
  }, [items.length]);

  function choose(item: Item) {
    setOpen(false);
    navigate(item.to);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (event.key === 'Enter' && items[active]) {
      event.preventDefault();
      choose(items[active]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="backdrop-in fixed inset-0 z-[90] bg-slate-950/30 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="pop-in origin-in-center w-full max-w-xl bg-white dark:bg-[#14141a] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800">
          <SearchIcon size={17} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, disciplinas, materiais..."
            className="w-full py-4 bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
          <kbd className="chip shrink-0">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              Nenhum resultado para "{query}"
            </p>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item)}
              className={`fade-slide-in w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                index === active
                  ? 'bg-violet-50 dark:bg-violet-950/50'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
              style={{ animationDelay: `${Math.min(index, 8) * 0.02}s` }}
            >
              <span
                className={`p-1.5 rounded-lg ${
                  index === active
                    ? 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <item.icon size={14} />
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {item.label}
              </span>
              <span className="ml-auto text-[11px] text-slate-400 shrink-0">{item.hint}</span>
              {index === active && <CornerDownLeft size={13} className="text-violet-400 shrink-0" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <kbd className="chip">↑↓</kbd> navegar
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <kbd className="chip">Enter</kbd> abrir
          </span>
          <span className="text-[11px] text-slate-400 ml-auto">
            {items.length} resultado{items.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}
