import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, BarChart3, Loader2, Plus, Send, Sparkles, Trash2, UserPlus, UserCheck, Type } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton } from '../components/Feedback';
import SocialPostCard, { SocialPost, timeAgo } from '../components/SocialPostCard';
import UserAvatar from '../components/UserAvatar';

type Suggestion = {
  id: string;
  name: string;
  avatar_path?: string | null;
  role: string;
  course?: string | null;
};

export default function Social() {
  const { user } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [feedLimit] = useState(20);
  const [mode, setMode] = useState<'TEXT' | 'POLL'>('TEXT');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const loadFeed = useCallback(async () => {
    try {
      const r = await api.get('/social/feed', { params: { limit: feedLimit } });
      setPosts(r.data);
    } catch {
      setPosts([]);
    }
  }, [feedLimit]);

  const loadSuggestions = useCallback(async () => {
    try {
      const r = await api.get('/social/suggestions');
      setSuggestions((r.data as Suggestion[]).filter((s) => s.id !== user?.id));
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    loadFeed();
    loadSuggestions();
  }, [loadFeed, loadSuggestions]);

  async function publish() {
    const text = content.trim();
    if (!text) return;
    let payload: { content: string; pollOptions?: string[] };
    if (mode === 'POLL') {
      const options = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (options.length < 2) {
        toast.error('A enquete precisa de pelo menos 2 opções.');
        return;
      }
      payload = { content: text, pollOptions: options };
    } else {
      payload = { content: text };
    }
    setPublishing(true);
    try {
      const r = await api.post('/social/posts', payload);
      setPosts((current) => [r.data, ...(current || [])]);
      setContent('');
      setPollOptions(['', '']);
      setMode('TEXT');
      toast.success(mode === 'POLL' ? 'Enquete publicada!' : 'Publicado!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível publicar.');
    } finally {
      setPublishing(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await api.get('/social/feed', {
        params: { limit: feedLimit, offset: posts?.length || 0 },
      });
      setPosts((current) => [...(current || []), ...r.data]);
    } catch {
      toast.error('Não foi possível carregar mais publicações.');
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleFollow(id: string) {
    try {
      const r = await api.post(`/social/users/${id}/follow`);
      setFollowingMap((current) => ({ ...current, [id]: r.data.following }));
      if (!r.data.following) {
        setSuggestions((current) => current.filter((s) => s.id !== id));
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível seguir.');
    }
  }

  return (
    <div>
      <div className="mb-7">
        <p className="text-violet-600 font-semibold">Colaboração</p>
        <h2 className="section-title mt-1">Comunidade</h2>
        <p className="muted mt-2">
          Compartilhe, siga colegas e professores e interaja com as publicações.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="eyebrow">Publicar como</span>
              <button
                onClick={() => setMode('TEXT')}
                className={`chip ${mode === 'TEXT' ? '!bg-violet-100 !text-violet-700 dark:!bg-violet-950 dark:!text-violet-300' : ''}`}
              >
                <Type size={12} className="inline -mt-0.5" /> Publicação
              </button>
              <button
                onClick={() => setMode('POLL')}
                className={`chip ${mode === 'POLL' ? '!bg-violet-100 !text-violet-700 dark:!bg-violet-950 dark:!text-violet-300' : ''}`}
              >
                <BarChart3 size={12} className="inline -mt-0.5" /> Enquete
              </button>
            </div>
            <div className="flex items-start gap-3">
              <UserAvatar
                name={user?.name || '?'}
                avatar={user?.avatar_path}
                size={42}
                className="mt-0.5"
              />
              <div className="flex-1">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    mode === 'POLL'
                      ? 'Qual é a pergunta da enquete?'
                      : 'No que você está pensando? Compartilhe com a turma…'
                  }
                  rows={3}
                  maxLength={500}
                  className="input resize-none"
                />
                {mode === 'POLL' && (
                  <div className="mt-3 space-y-2">
                    {pollOptions.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 grid place-items-center shrink-0">
                          {index + 1}
                        </span>
                        <input
                          value={option}
                          onChange={(e) =>
                            setPollOptions((current) =>
                              current.map((o, i) => (i === index ? e.target.value : o))
                            )
                          }
                          placeholder={`Opção ${index + 1}`}
                          maxLength={80}
                          className="input !py-2 text-sm"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() =>
                              setPollOptions((current) => current.filter((_, i) => i !== index))
                            }
                            title="Remover opção"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 5 && (
                      <button
                        onClick={() => setPollOptions((current) => [...current, ''])}
                        className="btn-secondary !py-1.5 text-xs"
                      >
                        <Plus size={13} /> Adicionar opção
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{content.length}/500</span>
                  <button
                    onClick={publish}
                    disabled={publishing || !content.trim()}
                    className="btn-primary"
                  >
                    {publishing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                    {mode === 'POLL' ? 'Publicar enquete' : 'Publicar'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {posts === null && (
            <div className="card p-5">
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {posts !== null && posts.length === 0 && (
            <EmptyState
              icon={AtSign}
              title="Seu feed está vazio"
              text="Publique algo ou siga outras pessoas para ver as publicações delas aqui."
            />
          )}

          {posts?.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              onDeleted={(id) => setPosts((current) => (current || []).filter((p) => p.id !== id))}
            />
          ))}

          {posts !== null && posts.length >= feedLimit && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-secondary w-full">
              {loadingMore ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Carregando…
                </>
              ) : (
                'Carregar mais'
              )}
            </button>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Sparkles size={17} className="text-violet-600" /> Quem seguir
            </h3>
            {suggestions.length === 0 && (
              <p className="muted text-sm">
                Você já segue todos, ou ainda não há outros usuários.
              </p>
            )}
            <ul className="space-y-1">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-2 -mx-2 rounded-xl">
                  <Link to={`/perfil/${s.id}`} className="hover:opacity-80 transition shrink-0">
                    <UserAvatar name={s.name} avatar={s.avatar_path} size={36} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/perfil/${s.id}`}
                      className="text-sm font-semibold hover:underline truncate block"
                    >
                      {s.name}
                    </Link>
                    <p className="text-xs text-slate-400 truncate">
                      {s.role === 'PROFESSOR' ? 'Professor' : s.course || 'Aluno'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFollow(s.id)}
                    className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
                      followingMap[s.id]
                        ? 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-red-200 hover:text-red-600'
                        : 'border-violet-200 dark:border-violet-800 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40'
                    }`}
                    title={followingMap[s.id] ? 'Deixar de seguir' : 'Seguir'}
                  >
                    {followingMap[s.id] ? <UserCheck size={14} /> : <UserPlus size={14} />}
                    {followingMap[s.id] ? 'Seguindo' : 'Seguir'}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {posts !== null && posts.length > 0 && (
            <div className="card p-5">
              <h3 className="font-bold mb-2">Atividade recente</h3>
              <ul className="space-y-2">
                {posts.slice(0, 4).map((p) => (
                  <li key={`recent-${p.id}`} className="text-xs">
                    <Link to={`/perfil/${p.author.id}`} className="font-semibold hover:underline">
                      {p.author.name}
                    </Link>
                    <span className="text-slate-400"> · {timeAgo(p.createdAt)}</span>
                    <p className="muted truncate">{p.content}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
