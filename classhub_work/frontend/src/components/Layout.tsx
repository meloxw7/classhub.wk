import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  UsersRound,
  X,
  Users,
  Bell,
  GraduationCap,
  BookMarked,
  Moon,
  Sun,
  Search as SearchIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api, fileUrl } from '../lib/api';
import NotificationsMenu from './NotificationsMenu';
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
  const nav = [
    ['/', 'Dashboard', LayoutDashboard],
    ['/busca', 'Busca', SearchIcon],
    ['/disciplinas', 'Disciplinas', BookOpen],
    ['/materiais', 'Materiais', FileText],
    ['/notas', 'Bloco de notas', NotebookPen],
    ['/agenda', 'Agenda', CalendarDays],
    ['/trabalhos', 'Trabalhos', ClipboardList],
    ['/boletim', 'Boletim', GraduationCap],
    ['/forum', 'Fórum', MessageSquare],
    ['/presenca', 'Presença', UsersRound],
    ['/salas', 'Salas de estudo', Users],
    ['/chat', 'Chat da turma', MessagesSquare],
    ['/abnt', 'Conversor ABNT', BookMarked],
  ] as const;
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white p-5 transform transition ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-2xl font-black">
              Class<span className="text-blue-400">Hub</span>
            </div>
            <div className="text-xs text-slate-400">Portal acadêmico integrado</div>
          </div>
          <button className="md:hidden" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav className="space-y-1">
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              onClick={() => setOpen(false)}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/notificacoes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-300 hover:bg-slate-800"
          >
            <Bell size={18} />
            Notificações{unread > 0 && <span className="ml-auto badge">{unread}</span>}
          </NavLink>
          {user?.role === 'PROFESSOR' && (
            <NavLink
              to="/professor"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`
              }
            >
              <GraduationCap size={18} />
              Painel do professor
            </NavLink>
          )}
        </nav>
        <NavLink
          to="/perfil"
          onClick={() => setOpen(false)}
          className="block mt-8 rounded-2xl bg-slate-900 p-4 hover:bg-slate-800 transition"
        >
          <div className="flex items-center gap-3">
            {user?.avatar_path ? (
              <img
                src={fileUrl(user.avatar_path)}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-10 h-10 rounded-full bg-blue-600 grid place-items-center font-bold text-sm shrink-0">
                {(user?.name || '?')
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Conta</p>
              <p className="font-semibold mt-0.5 truncate">{user?.name}</p>
              <p className="text-sm text-blue-400">
                {user?.role === 'PROFESSOR' ? 'Professor' : 'Aluno'}
              </p>
            </div>
          </div>
        </NavLink>
        <button
          onClick={logout}
          className="absolute bottom-5 left-5 right-5 flex gap-2 items-center justify-center py-3 rounded-xl bg-slate-900 hover:bg-slate-800"
        >
          <LogOut size={18} /> Sair
        </button>
      </aside>
      <main className="md:ml-72 min-h-screen">
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex items-center gap-4">
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
              onClick={() => setDark((d) => !d)}
              title={dark ? 'Modo claro' : 'Modo escuro'}
              className="btn-secondary !px-3 !py-2 rounded-xl"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationsMenu unread={unread} />
          </div>
        </header>
        <section className="p-4 md:p-8 max-w-7xl mx-auto">
          <div key={location.pathname} className="page-in">
            <Outlet />
          </div>
        </section>
      </main>
    </div>
  );
}
