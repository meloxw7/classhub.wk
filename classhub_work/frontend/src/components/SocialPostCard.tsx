import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  Heart,
  Loader2,
  MessageCircle,
  Reply,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from './Toast';
import UserAvatar from './UserAvatar';

export type SocialAuthor = {
  id: string;
  name: string;
  username?: string | null;
  avatar_path?: string | null;
  role: string;
};

export type SocialComment = {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  author: SocialAuthor;
  mentions?: { username: string; id: string }[];
};

export type SocialPost = {
  id: string;
  content: string;
  createdAt: string;
  author: SocialAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  pollOptions?: string[] | null;
  pollCounts?: Record<string, number> | null;
  pollTotal?: number;
  myVote?: number | null;
  repost?: {
    materialId: string;
    title: string;
    subjectId: string;
    type: string;
  } | null;
  mentions?: { username: string; id: string }[];
};

const MENTION_TOKEN_RE = /@([a-z0-9_]{3,20})/gi;

export function renderContent(
  content: string,
  mentions?: { username: string; id: string }[]
) {
  const known = new Map((mentions || []).map((m) => [m.username, m.id]));
  const parts: (string | { username: string; id: string })[] = [];
  let lastIndex = 0;
  for (const match of String(content || '').matchAll(MENTION_TOKEN_RE)) {
    const username = match[1].toLowerCase();
    const id = known.get(username);
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(content.slice(lastIndex, start));
    if (id) {
      parts.push({ username, id });
    } else {
      parts.push(match[0]);
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts.map((part, index) =>
    typeof part === 'string' ? (
      <Fragment key={index}>{part}</Fragment>
    ) : (
      <Link
        key={index}
        to={`/perfil/${part.id}`}
        className="text-violet-600 dark:text-violet-400 font-semibold hover:underline"
      >
        @{part.username}
      </Link>
    )
  );
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function SocialPostCard({
  post,
  onDeleted,
}: {
  post: SocialPost;
  onDeleted?: (id: string) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<SocialComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentBusy, setCommentBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<SocialComment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [myVote, setMyVote] = useState<number | null>(post.myVote ?? null);
  const [pollCounts, setPollCounts] = useState<Record<string, number>>(post.pollCounts || {});
  const [pollTotal, setPollTotal] = useState(post.pollTotal || 0);
  const [voteBusy, setVoteBusy] = useState<number | null>(null);
  const mine = user?.id === post.author.id;
  const isPoll = !!post.pollOptions?.length;

  async function vote(optionIndex: number) {
    if (voteBusy !== null) return;
    setVoteBusy(optionIndex);
    try {
      const r = await api.post(`/social/posts/${post.id}/vote`, { optionIndex });
      setMyVote(r.data.myVote);
      setPollCounts(r.data.pollCounts || {});
      setPollTotal(r.data.pollTotal || 0);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível votar.');
    } finally {
      setVoteBusy(null);
    }
  }

  async function toggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    setLiked((v) => !v);
    setLikeCount((n) => n + (liked ? -1 : 1));
    try {
      const r = await api.post(`/social/posts/${post.id}/like`);
      setLiked(r.data.liked);
      setLikeCount(r.data.likeCount);
    } catch {
      setLiked(post.likedByMe);
      setLikeCount(post.likeCount);
      toast.error('Não foi possível curtir.');
    } finally {
      setLikeBusy(false);
    }
  }

  async function loadComments() {
    setCommentsLoading(true);
    try {
      const r = await api.get(`/social/posts/${post.id}/comments`);
      setComments(r.data);
    } catch {
      toast.error('Não foi possível carregar os comentários.');
    } finally {
      setCommentsLoading(false);
    }
  }

  function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments === null) loadComments();
  }

  async function addComment() {
    const content = commentText.trim();
    if (!content) return;
    setCommentBusy(true);
    try {
      const r = await api.post(`/social/posts/${post.id}/comments`, {
        content,
        parentId: replyTo?.id,
      });
      setComments((current) => [...(current || []), r.data]);
      setCommentText('');
      setReplyTo(null);
      setCommentCount((n) => n + 1);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível comentar.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function removeComment(id: string) {
    try {
      await api.delete(`/social/comments/${id}`);
      setComments((current) => (current || []).filter((c) => c.id !== id));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch {
      toast.error('Não foi possível excluir o comentário.');
    }
  }

  async function removePost() {
    if (!window.confirm('Excluir esta publicação?')) return;
    setDeleting(true);
    try {
      await api.delete(`/social/posts/${post.id}`);
      onDeleted?.(post.id);
    } catch {
      toast.error('Não foi possível excluir.');
    } finally {
      setDeleting(false);
    }
  }

  function renderComment(c: SocialComment, isReply: boolean) {
    return (
      <div className="flex items-start gap-2 group">
        <Link to={`/perfil/${c.author.id}`} className="shrink-0 hover:opacity-80 transition">
          <UserAvatar name={c.author.name} avatar={c.author.avatar_path} size={isReply ? 22 : 28} />
        </Link>
        <div className="min-w-0 flex-1 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/perfil/${c.author.id}`}
              className="text-xs font-semibold hover:underline"
            >
              {c.author.name}
            </Link>
            <span className="text-[10px] text-slate-400">{timeAgo(c.createdAt)}</span>
            <button
              onClick={() => {
                setReplyTo(c);
                setCommentsOpen(true);
              }}
              title="Responder"
              className="text-slate-300 hover:text-violet-600 transition"
            >
              <Reply size={12} />
            </button>
            {user?.id === c.author.id && (
              <button
                onClick={() => removeComment(c.id)}
                title="Excluir comentário"
                className="ml-auto text-slate-300 hover:text-red-500 transition"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <p className="text-xs mt-0.5 whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">
            {renderContent(c.content, c.mentions)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article className="card p-5 fade-slide-in">
      <div className="flex items-start gap-3">
        <Link to={`/perfil/${post.author.id}`} className="hover:opacity-80 transition shrink-0">
          <UserAvatar name={post.author.name} avatar={post.author.avatar_path} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/perfil/${post.author.id}`}
              className="font-semibold text-sm hover:underline truncate"
            >
              {post.author.name}
            </Link>
            {post.author.username && (
              <Link
                to={`/perfil/${post.author.id}`}
                className="text-xs text-violet-500 dark:text-violet-400 hover:underline truncate max-w-[140px]"
              >
                @{post.author.username}
              </Link>
            )}
            {post.author.role === 'PROFESSOR' && <span className="chip">Professor</span>}
            <span className="text-xs text-slate-400">· {timeAgo(post.createdAt)}</span>
          </div>
          {post.content && (
            <p className="text-sm mt-1.5 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">
              {renderContent(post.content, post.mentions)}
            </p>
          )}
          {post.repost && (
            <Link
              to={`/disciplinas/${post.repost.subjectId}`}
              className="mt-2 block rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 hover:border-violet-300 dark:hover:border-violet-700 transition"
            >
              <span className="flex items-center gap-2">
                <FileText size={15} className="text-violet-600 shrink-0" />
                <span className="text-sm font-semibold truncate">{post.repost.title}</span>
              </span>
              <span className="text-[11px] text-slate-400 mt-1 block">
                material compartilhado · clique para abrir a disciplina
              </span>
            </Link>
          )}
          {isPoll && (
            <div className="mt-3 space-y-2">
              {post.pollOptions!.map((option, index) => {
                const votes = pollCounts[String(index)] || 0;
                const percent = pollTotal > 0 ? Math.round((votes / pollTotal) * 100) : 0;
                const voted = myVote === index;
                return (
                  <button
                    key={index}
                    onClick={() => vote(index)}
                    disabled={voteBusy !== null}
                    className={`relative w-full text-left rounded-xl border px-3 py-2 text-sm font-medium transition overflow-hidden ${
                      voted
                        ? 'border-violet-400 text-violet-700 dark:text-violet-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300 dark:hover:border-violet-700'
                    } ${voteBusy === index ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 rounded-l-xl transition-all duration-500 ${
                        voted ? 'bg-violet-100 dark:bg-violet-950/70' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="truncate">
                        {option}
                        {voted && ' ✓'}
                      </span>
                      {pollTotal > 0 && <span className="text-xs shrink-0">{percent}%</span>}
                    </span>
                  </button>
                );
              })}
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <BarChart3 size={12} />
                {pollTotal} voto{pollTotal === 1 ? '' : 's'}
                {myVote !== null && ' · clique para mudar seu voto'}
              </p>
            </div>
          )}
          <div className="flex items-center gap-1 mt-3 -ml-1">
            <button
              onClick={toggleLike}
              disabled={likeBusy}
              title={liked ? 'Descurtir' : 'Curtir'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                liked
                  ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  : 'text-slate-500 hover:text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Heart size={15} className={liked ? 'fill-rose-600 text-rose-600' : ''} />
              {likeCount > 0 ? likeCount : 'Curtir'}
            </button>
            <button
              onClick={toggleComments}
              title="Comentários"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-violet-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <MessageCircle size={15} />
              {commentCount > 0 ? commentCount : 'Comentar'}
            </button>
            {mine && (
              <button
                onClick={removePost}
                disabled={deleting}
                title="Excluir publicação"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
              >
                {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              </button>
            )}
          </div>
          {commentsOpen && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              {commentsLoading && <p className="muted text-xs">Carregando comentários…</p>}
              {comments === null && !commentsLoading && (
                <p className="muted text-xs">Sem comentários ainda.</p>
              )}
              {comments?.length === 0 && !commentsLoading && (
                <p className="muted text-xs">Seja o primeiro a comentar.</p>
              )}
              {(comments || [])
                .filter((c) => !c.parentId)
                .map((c) => (
                  <div key={c.id} className="space-y-2">
                    {renderComment(c, false)}
                    {(comments || [])
                      .filter((r) => r.parentId === c.id)
                      .map((r) => (
                        <div key={r.id} className="pl-10">
                          {renderComment(r, true)}
                        </div>
                      ))}
                  </div>
                ))}
              {replyTo && (
                <p className="text-xs text-violet-600 font-semibold flex items-center gap-1">
                  <Reply size={12} /> respondendo {replyTo.author.name}
                  <button
                    onClick={() => setReplyTo(null)}
                    className="text-slate-400 hover:text-red-500 transition ml-1"
                    title="Cancelar resposta"
                  >
                    <X size={12} />
                  </button>
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addComment();
                  }}
                  placeholder={replyTo ? `Responder ${replyTo.author.name}…` : 'Escreva um comentário…'}
                  maxLength={500}
                  className="input !py-2 text-xs flex-1"
                />
                <button
                  onClick={addComment}
                  disabled={commentBusy || !commentText.trim()}
                  className="btn-primary !px-3 !py-2 rounded-xl"
                  title="Enviar comentário"
                >
                  {commentBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
