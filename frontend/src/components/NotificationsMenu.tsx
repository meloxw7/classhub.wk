import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './Toast';
import { Skeleton } from './Feedback';

const NOTIF_TYPE_LABELS: Record<string, string> = {
  MATERIAL: 'Material',
  EVENT: 'Evento',
  NOTICE: 'Aviso',
  ASSIGNMENT: 'Trabalho',
  GRADE: 'Correção',
  FORUM: 'Fórum',
  INFO: 'Info',
};

export default function NotificationsMenu({ unread }: { unread: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  async function load() {
    setLoading(true);

    try {
      const response = await api.get('/notifications');

      setItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast.error('Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    setOpen((value) => {
      const next = !value;

      if (next) {
        load();
      }

      return next;
    });
  }

  async function read(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      await load();
    } catch (error) {
      console.error('Erro ao marcar notificação:', error);
      toast.error('Não foi possível marcar a notificação.');
    }
  }

  async function readAll() {
    try {
      await api.patch('/notifications/read-all');
      await load();
    } catch (error) {
      console.error('Erro ao marcar notificações:', error);
      toast.error('Não foi possível marcar todas como lidas.');
    }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/notifications/${id}`);

      await load();
    } catch (error) {
      console.error('Erro ao apagar notificação:', error);
      toast.error('Não foi possível apagar a notificação.');
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative p-2 rounded-xl hover:bg-slate-100">
        <Bell size={20} />

        {unread > 0 && <span className="absolute -right-1 -top-1 badge text-[10px]">{unread}</span>}
      </button>

      {open && (
        <div className="toast-in card absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <b className="text-sm">Notificações</b>

            {items.length > 0 && (
              <button
                onClick={readAll}
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <CheckCheck size={14} />
                Marcar todas lidas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-4">
                  <Skeleton className="h-4 w-2/3 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}

            {!loading &&
              items.slice(0, 8).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => read(notification.id)}
                  className={`group w-full text-left px-4 py-3 hover:bg-slate-50 transition cursor-pointer ${
                    !notification.read_at ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <b className="text-sm">{notification.title}</b>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="chip">
                        {NOTIF_TYPE_LABELS[notification.type] || notification.type}
                      </span>

                      {!notification.read_at && <span className="chip">Nova</span>}

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          remove(notification.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Apagar notificação"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notification.body}</p>

                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(notification.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}

            {!loading && !items.length && (
              <div className="p-6 text-center">
                <Bell size={24} className="mx-auto text-slate-300" />
                <p className="muted mt-2">Nenhuma notificação.</p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-200">
            <NavLink
              to="/notificacoes"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver todas →
            </NavLink>
          </div>
        </div>
      )}
    </div>
  );
}
