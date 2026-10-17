import { useEffect, useRef, useState } from 'react';
import { Loader2, MessagesSquare, Send } from 'lucide-react';

import { api, fileUrl, refreshSession } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton } from '../components/Feedback';

function wsBaseUrl() {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  return base.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
}

export default function Chat() {
  const { user } = useAuth();
  const toast = useToast();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [typingUser, setTypingUser] = useState('');
  const [connected, setConnected] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const typingSentAtRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const subjectIdRef = useRef('');

  useEffect(() => {
    subjectIdRef.current = subjectId;
  }, [subjectId]);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const response = await api.get('/subjects');

        setSubjects(response.data);

        if (response.data[0]) {
          setSubjectId(response.data[0].id);
        }
      } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
        toast.error('Não foi possível carregar as disciplinas.');
      } finally {
        setLoadingSubjects(false);
      }
    }

    loadSubjects();
  }, [toast]);

  useEffect(() => {
    if (!localStorage.getItem('classhub_token')) return;

    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let currentWs: WebSocket | null = null;

    function connect() {
      if (closed) return;

      const token = localStorage.getItem('classhub_token');
      if (!token) return;

      const ws = new WebSocket(`${wsBaseUrl()}?token=${token}`);

      currentWs = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;

        setConnected(true);

        if (subjectIdRef.current) {
          ws.send(
            JSON.stringify({
              type: 'join',
              subjectId: subjectIdRef.current,
            })
          );
        }
      };

      ws.onmessage = (event) => {
        let data: any;

        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === 'message') {
          setMessages((previous) => {
            if (previous.some((item) => item.id === data.id)) {
              return previous;
            }

            return [...previous, data];
          });

          return;
        }

        if (data.type === 'presence') {
          setPresence(data.users || []);
          return;
        }

        if (data.type === 'typing') {
          setTypingUser(data.typing ? data.userName : '');

          if (data.typing) {
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }

            typingTimeoutRef.current = setTimeout(() => setTypingUser(''), 4000);
          }
        }
      };

      ws.onclose = (event) => {
        if (currentWs !== ws) return;

        if (wsRef.current === ws) {
          wsRef.current = null;
        }

        setConnected(false);

        if (closed) return;

        if (event.code === 4001) {
          refreshSession().then((fresh) => {
            if (closed) return;
            if (fresh) {
              retry = setTimeout(connect, 500);
              return;
            }
            toast.error('Sessão expirada. Entre novamente.');

            localStorage.removeItem('classhub_token');
            localStorage.removeItem('classhub_refresh');
            localStorage.removeItem('classhub_user');

            window.location.href = '/login';
          });

          return;
        }

        retry = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    }

    connect();

    return () => {
      closed = true;

      if (retry) {
        clearTimeout(retry);
      }

      try {
        currentWs?.close();
      } catch {}

      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conecta uma vez ao montar
  }, []);

  useEffect(() => {
    if (!subjectId) return;

    setMessages([]);
    setPresence([]);
    setTypingUser('');

    async function loadHistory() {
      try {
        const response = await api.get(`/chat/${subjectId}`);

        setMessages(response.data);
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      }
    }

    loadHistory();

    const ws = wsRef.current;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'join', subjectId }));
    }
  }, [subjectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
    });
  }, [messages, typingUser]);

  function notifyTyping() {
    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const now = Date.now();

    if (now - typingSentAtRef.current < 2000) return;

    typingSentAtRef.current = now;

    ws.send(JSON.stringify({ type: 'typing', typing: true }));

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      ws.send(
        JSON.stringify({
          type: 'typing',
          typing: false,
        })
      );
    }, 2500);
  }

  async function send() {
    const content = input.trim();

    if (!content || !subjectId) return;

    const ws = wsRef.current;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Chat reconectando. Tente em instantes.');
      return;
    }

    setSending(true);

    try {
      ws.send(JSON.stringify({ type: 'message', content }));

      setInput('');

      ws.send(JSON.stringify({ type: 'typing', typing: false }));
    } finally {
      setSending(false);
    }
  }

  const subject = subjects.find((item) => item.id === subjectId);

  return (
    <div>
      <div className="mb-7">
        <p className="text-violet-600 font-semibold">Tempo real</p>

        <h2 className="section-title mt-1">Chat da turma</h2>

        <p className="muted mt-2">Mensagens ao vivo por disciplina, com histórico e presença.</p>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap items-center gap-3">
        <select
          className="input max-w-xs"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <span
          className={`chip ${
            connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {connected ? 'Conectado' : 'Reconectando...'}
        </span>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 items-start">
        <div className="lg:col-span-3 card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold">{subject?.name || 'Selecione a disciplina'}</h3>

              <p className="text-xs text-slate-400 mt-0.5">
                {typingUser ? `${typingUser} está digitando...` : `${presence.length} online`}
              </p>
            </div>

            <MessagesSquare className="text-violet-600" />
          </div>

          <div ref={scrollRef} className="h-[26rem] overflow-y-auto p-5 space-y-3 bg-slate-50/60">
            {loadingSubjects && <Skeleton className="h-16 w-full" />}

            {!loadingSubjects &&
              messages.map((message) => {
                const mine = message.userId === user?.id;

                return (
                  <div
                    key={message.id}
                    className={`flex gap-2 items-end ${mine ? 'flex-row-reverse' : ''}`}
                  >
                    {message.avatar_path ? (
                      <img
                        src={fileUrl(message.avatar_path)}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 text-xs font-bold grid place-items-center shrink-0">
                        {(message.userName || '?')
                          .split(' ')
                          .map((part: string) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </span>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-2 max-w-[75%] ${
                        mine
                          ? 'bg-violet-600 text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 rounded-bl-sm'
                      }`}
                    >
                      {!mine && (
                        <p className="text-xs font-bold text-violet-600 mb-0.5">{message.userName}</p>
                      )}

                      <p className="text-sm break-words">{message.content}</p>

                      <p
                        className={`text-[10px] mt-1 ${mine ? 'text-violet-200' : 'text-slate-400'}`}
                      >
                        {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

            {!loadingSubjects && !messages.length && (
              <EmptyState
                icon={MessagesSquare}
                title="Nenhuma mensagem ainda"
                text="Comece a conversa com a sua turma."
              />
            )}
          </div>

          <div className="p-4 border-t border-slate-200 flex gap-2">
            <input
              className="input"
              placeholder="Escreva uma mensagem..."
              value={input}
              disabled={!connected}
              onChange={(e) => {
                setInput(e.target.value);
                notifyTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />

            <button
              className="btn-primary"
              onClick={send}
              disabled={sending || !connected || !input.trim()}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold mb-3">Online agora ({presence.length})</h3>

          <div className="space-y-2">
            {presence.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <span className="relative">
                  {entry.avatar ? (
                    <img
                      src={fileUrl(entry.avatar)}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 text-xs font-bold grid place-items-center">
                      {(entry.name || '?')
                        .split(' ')
                        .map((part: string) => part[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  )}

                  <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                </span>

                <p className="text-sm font-medium truncate">{entry.name}</p>
              </div>
            ))}

            {!presence.length && <p className="muted text-sm">Ninguém conectado no momento.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
