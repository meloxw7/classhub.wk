import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  NotebookPen,
  X,
  Users,
  Bell,
  GraduationCap,
  BookMarked,
  Moon,
  Sun,
  Search as SearchIcon,
  Sparkles,
  AtSign,
  Layers,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, fileUrl } from '../lib/api';
import NotificationsMenu from './NotificationsMenu';
import CommandPalette from './CommandPalette';

function openCommandPalette() {
  window.dispatchEvent(new Event('classhub:open-command'));
}
export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [dark, setDark] = useState(
    () =>
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('classhub_theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);
  useEffect(() => {
    const load = () =>
      api
        .get('/stats')
        .then((r) => setUnread(r.data.unreadNotifications))
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  const groups: [string, (readonly [string, string, typeof BookOpen])[]][] = [
    [
      'Acadêmico',
      [
        ['/', 'Dashboard', LayoutDashboard],
        ['/disciplinas', 'Disciplinas', BookOpen],
        ['/materiais', 'Materiais', FileText],
        ['/notas', 'Bloco de notas', NotebookPen],
        ['/agenda', 'Agenda', CalendarDays],
        ['/trabalhos', 'Trabalhos', ClipboardList],
        ['/boletim', 'Boletim', GraduationCap],
      ],
    ],
    [
      'Colaboração',
      [
        ['/social', 'Comunidade', AtSign],
        ['/mensagens', 'Mensagens', Mail],
        ['/salas', 'Salas de estudo', Users],
        ['/chat', 'Chat da turma', MessagesSquare],
      ],
    ],
    [
      'Ferramentas',
      [
        ['/busca', 'Busca', SearchIcon],
        ['/tutor', 'Lumi', Sparkles],
        ['/flashcards', 'Flashcards', Layers],
        ['/abnt', 'Conversor ABNT', BookMarked],
      ],
    ],
  ];
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-slate-950">
      <CommandPalette />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#0e0e14] border-r border-slate-200/80 dark:border-slate-800 p-5 pb-0 flex flex-col transform transition ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-violet-600 grid place-items-center shrink-0">
              <GraduationCap size={18} className="text-white" />
            </span>
            <div>
              <div className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Class<span className="text-violet-600">Hub</span>
              </div>
              <div className="text-[11px] text-slate-400">Portal acadêmico</div>
            </div>
          </div>
          <button className="md:hidden text-slate-500" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto min-h-0">
          {groups.map(([group, items]) => (
            <div key={group} className="mb-3">
              <p className="eyebrow px-3 mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {items.map(([to, label, Icon]) => (
                  <NavLink
                    key={to}
                    onClick={() => setOpen(false)}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                      }`
                    }
                  >
                    <Icon size={17} className="transition-transform duration-200 group-aria-[current=page]:scale-110 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
          <div className="mb-3">
            <p className="eyebrow px-3 mb-1.5">Conta</p>
            <NavLink
              to="/notificacoes"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`
              }
            >
              <Bell size={17} className="transition-transform duration-200 group-aria-[current=page]:scale-110 shrink-0" />
              Notificações{unread > 0 && <span className="ml-auto badge">{unread}</span>}
            </NavLink>
            {user?.role === 'PROFESSOR' && (
              <NavLink
                to="/professor"
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                  }`
                }
              >
                <GraduationCap size={17} className="transition-transform duration-200 group-aria-[current=page]:scale-110 shrink-0" />
                Painel do professor
              </NavLink>
            )}
          </div>
        </nav>
        <NavLink
          to="/perfil"
          onClick={() => setOpen(false)}
          className="block mt-6 mb-20 shrink-0 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 hover:border-violet-300 dark:hover:border-violet-800 transition"
        >
          <div className="flex items-center gap-3">
            {user?.avatar_path ? (
              <img
                src={fileUrl(user.avatar_path)}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-violet-600 grid place-items-center font-bold text-sm text-white shrink-0">
                {(user?.name || '?')
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Conta</p>
              <p className="font-semibold mt-0.5 truncate text-slate-900 dark:text-slate-100">
                {user?.name}
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                {user?.role === 'PROFESSOR' ? 'Professor' : 'Aluno'}
              </p>
            </div>
          </div>
        </NavLink>
        <button
          onClick={logout}
          className="absolute bottom-5 left-5 right-5 flex gap-2 items-center justify-center py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#14141a] text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:hover:border-red-900 font-semibold text-sm transition"
        >
          <LogOut size={16} /> Sair
        </button>
      </aside>
      <main className="md:ml-72 min-h-screen">
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 dark:border-slate-800 px-4 md:px-8 py-4 flex items-center gap-4">
          <button className="md:hidden" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <h1 className="font-bold text-lg">Olá, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tudo organizado em um só lugar.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={openCommandPalette}
              title="Buscar (Ctrl+K)"
              className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#14141a] px-3 py-2 text-sm text-slate-400 hover:border-violet-300 dark:hover:border-violet-700 transition"
            >
              <SearchIcon size={15} />
              <span className="hidden lg:inline">Buscar...</span>
              <kbd className="hidden lg:inline chip">Ctrl K</kbd>
            </button>
            <button
              onClick={openCommandPalette}
              title="Buscar (Ctrl+K)"
              className="sm:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <SearchIcon size={20} />
            </button>
            <button
              onClick={() => setDark((d) => !d)}
              title={dark ? 'Modo claro' : 'Modo escuro'}
              className="btn-secondary !px-3 !py-2 rounded-xl"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationsMenu unread={unread} />
          </div>
        </header>
        <section className="p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto">
          <div key={location.pathname} className="page-in">
            <Outlet />
          </div>
        </section>
      </main>
      {/* TAB BAR MOBILE */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0e0e14]/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 dark:border-slate-800 flex">
        {(
          [
            ['/', 'Início', LayoutDashboard, false],
            ['/agenda', 'Agenda', CalendarDays, false],
            ['/trabalhos', 'Trabalhos', ClipboardList, false],
            ['/chat', 'Chat', MessagesSquare, false],
            ['/notificacoes', 'Avisos', Bell, true],
          ] as const
        ).map(([to, label, Icon, showBadge]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                isActive
                  ? 'text-violet-600 dark:text-violet-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`
            }
          >
            <span className="relative">
              <Icon size={20} />
              {showBadge && unread > 0 && (
                <span className="absolute -right-1.5 -top-1 w-2 h-2 rounded-full bg-red-500" />
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
