import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  Mic,
  MessagesSquare,
  Send,
  Square,
  Play,
} from 'lucide-react';
import { api, fileUrl, refreshSession } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton } from '../components/Feedback';
import UserAvatar from '../components/UserAvatar';

type DmMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'TEXT' | 'IMAGE' | 'AUDIO';
  content: string;
  filePath?: string | null;
  fileName?: string | null;
  durationMs?: number | null;
  readAt?: string | null;
  createdAt: string;
};

type Conversation = {
  partner: { id: string; name: string; username?: string | null; avatar_path?: string | null; role: string };
  lastMessage: DmMessage;
  unread: number;
};

function wsBaseUrl() {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  return base.replace(/^http/, 'ws').replace(/\/api\/?$/, '');
}

function formatPreview(message: DmMessage) {
  if (message.type === 'IMAGE') return '📷 Imagem';
  if (message.type === 'AUDIO') return '🎤 Áudio';
  return message.content;
}

function formatDuration(ms?: number | null) {
  const total = Math.round((ms || 0) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activePartner, setActivePartner] = useState<{
    id: string;
    name: string;
    username?: string | null;
    avatar_path?: string | null;
  } | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activePartnerRef = useRef(activePartner);
  const typingSentAtRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef(0);

  useEffect(() => {
    activePartnerRef.current = activePartner;
  }, [activePartner]);

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.get('/direct/conversations');
      setConversations(r.data);
    } catch {
      setConversations([]);
    }
  }, []);

  const openConversation = useCallback(async (partnerId: string) => {
    setLoadingChat(true);
    setMessages([]);
    setTyping(false);
    try {
      const r = await api.get(`/direct/${partnerId}`);
      setActivePartner({
        id: r.data.partner.id,
        name: r.data.partner.name,
        username: r.data.partner.username,
        avatar_path: r.data.partner.avatar_path,
      });
      setMessages(r.data.messages);
      setConversations((current) =>
        (current || []).map((c) => (c.partner.id === partnerId ? { ...c, unread: 0 } : c))
      );
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'dm-join', recipientId: partnerId }));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível abrir a conversa.');
      setActivePartner(null);
    } finally {
      setLoadingChat(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Deep-link ?u=userid
  useEffect(() => {
    const target = params.get('u');
    if (target && target !== activePartnerRef.current?.id) {
      openConversation(target);
      setMobileChat(true);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // WebSocket connection
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
        const partner = activePartnerRef.current;
        if (partner) {
          ws.send(JSON.stringify({ type: 'dm-join', recipientId: partner.id }));
        }
      };

      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.type === 'dm-message') {
          const message: DmMessage = data.message;
          const partner = activePartnerRef.current;
          const involvesPartner =
            partner &&
            (message.senderId === partner.id || message.recipientId === partner.id);
          if (involvesPartner) {
            setMessages((previous) => {
              if (previous.some((m) => m.id === message.id)) return previous;
              return [...previous, message];
            });
            setTyping(false);
            if (message.senderId === partner.id) {
              api.patch(`/direct/${partner.id}/read`).catch(() => {});
            }
          }
          loadConversations();
          return;
        }
        if (data.type === 'dm-typing') {
          const partner = activePartnerRef.current;
          if (partner && data.userId === partner.id) {
            setTyping(!!data.typing);
          }
        }
      };

      ws.onclose = (closeEvent) => {
        if (currentWs !== ws) return;
        if (wsRef.current === ws) wsRef.current = null;
        setConnected(false);
        if (closed) return;
        if (closeEvent.code === 4001) {
          refreshSession().then((fresh) => {
            if (closed) return;
            if (fresh) {
              retry = setTimeout(connect, 500);
              return;
            }
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
      if (retry) clearTimeout(retry);
      try {
        currentWs?.close();
      } catch {}
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, typing]);

  function notifyTyping() {
    const ws = wsRef.current;
    const partner = activePartnerRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !partner) return;
    const now = Date.now();
    if (now - typingSentAtRef.current < 2000) return;
    typingSentAtRef.current = now;
    ws.send(JSON.stringify({ type: 'dm-typing', recipientId: partner.id, typing: true }));
  }

  function send() {
    const content = input.trim();
    const partner = activePartnerRef.current;
    const ws = wsRef.current;
    if (!content || !partner || !ws || ws.readyState !== WebSocket.OPEN) {
      if (content && partner) toast.error('Chat reconectando. Tente em instantes.');
      return;
    }
    setSending(true);
    try {
      ws.send(
        JSON.stringify({ type: 'dm-message', recipientId: partner.id, content })
      );
      ws.send(JSON.stringify({ type: 'dm-typing', recipientId: partner.id, typing: false }));
      setInput('');
    } finally {
      setSending(false);
    }
  }

  async function uploadMedia(file: File, type: 'IMAGE' | 'AUDIO', durationMs?: number) {
    const partner = activePartnerRef.current;
    if (!partner) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('recipientId', partner.id);
      formData.append('type', type);
      if (durationMs) formData.append('durationMs', String(durationMs));
      formData.append('file', file);
      const r = await api.post('/direct/upload', formData);
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: 'dm-file', recipientId: partner.id, messageId: r.data.id })
        );
      } else {
        setMessages((previous) =>
          previous.some((m) => m.id === r.data.id) ? previous : [...previous, r.data]
        );
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Falha ao enviar mídia.');
    } finally {
      setUploading(false);
    }
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem: máximo de 5MB.');
      return;
    }
    uploadMedia(file, 'IMAGE');
    event.target.value = '';
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordStartRef.current = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const duration = Date.now() - recordStartRef.current;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1000 || duration < 500) return;
        const extension = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `audio-${Date.now()}.${extension}`, {
          type: recorder.mimeType || 'audio/webm',
        });
        uploadMedia(file, 'AUDIO', duration);
      };
      recorder.start();
      setRecording(true);
    } catch {
      toast.error('Não foi possível acessar o microfone.');
    }
  }

  function renderMessage(message: DmMessage) {
    if (message.type === 'IMAGE' && message.filePath) {
      return (
        <a href={fileUrl(message.filePath)} target="_blank" rel="noreferrer">
          <img
            src={fileUrl(message.filePath)}
            alt="Imagem enviada"
            className="rounded-xl max-w-[220px] max-h-[220px] object-cover"
          />
        </a>
      );
    }
    if (message.type === 'AUDIO' && message.filePath) {
      return (
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-white/20">
            <Play size={12} />
          </span>
          <audio controls src={fileUrl(message.filePath)} className="!h-8 max-w-[200px]" />
          {message.durationMs ? (
            <span className="text-[10px] opacity-80">{formatDuration(message.durationMs)}</span>
          ) : null}
        </div>
      );
    }
    return <p className="text-sm break-words">{message.content}</p>;
  }

  return (
    <div>
      <div className="mb-7">
        <p className="text-violet-600 font-semibold">Colaboração</p>
        <h2 className="section-title mt-1">Mensagens</h2>
        <p className="muted mt-2">
          Conversas privadas com texto, fotos e áudio — em tempo real.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className={`card p-0 overflow-hidden ${mobileChat ? 'hidden lg:block' : ''}`}>
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold">Conversas</h3>
            <span
              className={`chip ${
                connected
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300'
              }`}
            >
              {connected ? 'Conectado' : 'Reconectando...'}
            </span>
          </div>
          <div className="max-h-[30rem] overflow-y-auto">
            {conversations === null && (
              <div className="p-5 space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {conversations !== null && conversations.length === 0 && (
              <p className="muted text-sm text-center py-8 px-4">
                Nenhuma conversa ainda. Abra o perfil de um colega e envie a primeira mensagem.
              </p>
            )}
            {(conversations || []).map((conversation) => (
              <button
                key={conversation.partner.id}
                onClick={() => {
                  openConversation(conversation.partner.id);
                  setMobileChat(true);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 text-left transition ${
                  activePartner?.id === conversation.partner.id
                    ? 'bg-violet-50 dark:bg-violet-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <UserAvatar
                  name={conversation.partner.name}
                  avatar={conversation.partner.avatar_path}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{conversation.partner.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {conversation.lastMessage.senderId === user?.id
                      ? `Você: ${formatPreview(conversation.lastMessage)}`
                      : formatPreview(conversation.lastMessage)}
                  </p>
                </div>
                {conversation.unread > 0 && (
                  <span className="badge shrink-0">{conversation.unread}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className={`lg:col-span-2 card p-0 overflow-hidden ${mobileChat ? '' : 'hidden lg:block'}`}>
          {!activePartner ? (
            <div className="p-6">
              <EmptyState
                icon={MessagesSquare}
                title="Selecione uma conversa"
                text="Suas conversas privadas aparecem à esquerda."
              />
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <button
                  className="lg:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                  onClick={() => {
                    setMobileChat(false);
                    setActivePartner(null);
                  }}
                  title="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  onClick={() => navigate(`/perfil/${activePartner.id}`)}
                  className="flex items-center gap-3 hover:opacity-80 transition"
                >
                  <UserAvatar
                    name={activePartner.name || '?'}
                    avatar={activePartner.avatar_path}
                    size={38}
                  />
                  <div className="text-left">
                    <h3 className="font-bold">
                      {activePartner.name || 'Conversa'}
                      {activePartner.username && (
                        <span className="text-sm text-violet-500 dark:text-violet-400 font-semibold ml-1.5">
                          @{activePartner.username}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {typing ? 'digitando…' : connected ? 'no momento' : 'reconectando…'}
                    </p>
                  </div>
                </button>
              </div>

              <div ref={scrollRef} className="h-[26rem] overflow-y-auto p-5 space-y-3 bg-slate-50/60 dark:bg-slate-900/50">
                {loadingChat && <Skeleton className="h-12 w-2/3" />}
                {!loadingChat && messages.length === 0 && (
                  <p className="muted text-sm text-center py-10">
                    Diga oi para {activePartner.name.split(' ')[0] || 'seu colega'} 👋
                  </p>
                )}
                {messages.map((message) => {
                  const mine = message.senderId === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`rounded-2xl px-4 py-2 max-w-[75%] ${
                          mine
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : 'bg-white dark:bg-[#1b1b24] border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                        }`}
                      >
                        {renderMessage(message)}
                        <p
                          className={`text-[10px] mt-1 ${mine ? 'text-violet-200' : 'text-slate-400'}`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {mine && message.readAt ? ' · lida' : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {typing && (
                  <p className="text-xs text-slate-400 px-2">digitando…</p>
                )}
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2 items-center">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={pickImage}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                  title="Enviar imagem (JPG/PNG, até 5MB)"
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-violet-600 hover:border-violet-300 transition shrink-0"
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ImageIcon size={16} />
                  )}
                </button>
                <button
                  onClick={toggleRecording}
                  disabled={uploading}
                  title={recording ? 'Parar e enviar' : 'Gravar áudio'}
                  className={`p-2.5 rounded-xl border transition shrink-0 ${
                    recording
                      ? 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950/40 animate-pulse'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:text-violet-600 hover:border-violet-300'
                  }`}
                >
                  {recording ? <Square size={16} /> : <Mic size={16} />}
                </button>
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
                  title="Enviar"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
