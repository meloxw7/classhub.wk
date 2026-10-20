import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  AtSign,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarDays,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MessageCircle,
  UserCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../components/Toast';
import { EmptyState, Skeleton } from '../components/Feedback';
import SocialPostCard, { SocialPost } from '../components/SocialPostCard';
import UserAvatar from '../components/UserAvatar';

type Badge = { id: string; label: string; description: string };

type Profile = {
  id: string;
  name: string;
  username?: string | null;
  role: string;
  avatar_path?: string | null;
  course?: string | null;
  semester?: string | null;
  institution?: string | null;
  bio?: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing: boolean;
  isFollower: boolean;
  badges: Badge[];
};

const badgeIcons: Record<string, typeof BookOpen> = {
  LEITOR: BookOpenCheck,
  COLABORADOR: HeartHandshake,
};

type UserCard = {
  id: string;
  name: string;
  avatar_path?: string | null;
  role: string;
  course?: string | null;
};

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [listOpen, setListOpen] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<UserCard[] | null>(null);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    if (!id || user?.id === id) return;
    setProfile(null);
    setPosts(null);
    setNotFound(false);
    api
      .get(`/social/users/${id}`)
      .then((r) => setProfile(r.data))
      .catch(() => setNotFound(true));
    api
      .get(`/social/users/${id}/posts`)
      .then((r) => setPosts(r.data))
      .catch(() => setPosts([]));
  }, [id, user?.id]);

  if (!id) return <Navigate to="/social" replace />;
  if (user?.id === id) return <Navigate to="/perfil" replace />;

  async function toggleFollow() {
    if (!profile) return;
    setFollowBusy(true);
    try {
      const r = await api.post(`/social/users/${profile.id}/follow`);
      setProfile({ ...profile, isFollowing: r.data.following, followerCount: r.data.followerCount });
      if (r.data.following) toast.success(`Agora você segue ${profile.name}.`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Não foi possível seguir.');
    } finally {
      setFollowBusy(false);
    }
  }

  async function openList(kind: 'followers' | 'following') {
    if (!profile) return;
    setListOpen(kind);
    setListUsers(null);
    setListLoading(true);
    try {
      const r = await api.get(`/social/users/${profile.id}/${kind}`);
      setListUsers(r.data);
    } catch {
      toast.error('Não foi possível carregar a lista.');
      setListOpen(null);
    } finally {
      setListLoading(false);
    }
  }

  if (notFound) {
    return (
      <EmptyState
        icon={UserRound}
        title="Usuário não encontrado"
        text="O perfil que você tentou abrir não existe."
      >
        <Link to="/social" className="btn-primary">
          Voltar para a comunidade
        </Link>
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <Link to="/social" className="text-sm text-violet-600 font-semibold hover:underline">
          ← Comunidade
        </Link>
      </div>

      {profile === null ? (
        <div className="card overflow-hidden p-0">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="p-5 -mt-10 space-y-3">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0 fade-slide-in">
          <div className="h-28 bg-gradient-to-r from-violet-100 via-fuchsia-100 to-violet-50 dark:from-violet-950 dark:via-fuchsia-950/60 dark:to-violet-900" />
          <div className="p-5 md:p-6 -mt-12 relative">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <UserAvatar
                name={profile.name}
                avatar={profile.avatar_path}
                size={88}
                className="ring-4 ring-white dark:ring-[#14141a]"
              />
              <div className="flex-1 min-w-0 md:pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {profile.name}
                  </h2>
                  {profile.username && (
                    <span className="text-sm text-violet-500 dark:text-violet-400 font-semibold">
                      @{profile.username}
                    </span>
                  )}
                  {profile.role === 'PROFESSOR' && <span className="chip">Professor</span>}
                  {profile.isFollower && (
                    <span className="chip" title="Esta pessoa segue você">
                      segue você
                    </span>
                  )}
                </div>
                {profile.bio && (
                  <p className="text-sm mt-2 text-slate-600 dark:text-slate-300 break-words">
                    {profile.bio}
                  </p>
                )}
                {profile.badges.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile.badges.map((badge) => {
                      const BadgeIcon = badgeIcons[badge.id] || GraduationCap;
                      return (
                        <span
                          key={badge.id}
                          title={badge.description}
                          className="chip !bg-amber-50 !text-amber-700 dark:!bg-amber-950/60 dark:!text-amber-300 flex items-center gap-1"
                        >
                          <BadgeIcon size={12} /> {badge.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {profile.course && (
                    <span className="flex items-center gap-1.5">
                      <BookOpen size={14} /> {profile.course}
                    </span>
                  )}
                  {profile.semester && (
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={14} /> {profile.semester}
                    </span>
                  )}
                  {profile.institution && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} /> {profile.institution}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/mensagens?u=${profile.id}`)}
                  title="Enviar mensagem"
                  className="btn-secondary"
                >
                  <MessageCircle size={16} />
                </button>
                <button
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={profile.isFollowing ? 'btn-secondary' : 'btn-primary'}
                >
                  {followBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : profile.isFollowing ? (
                    <UserCheck size={16} />
                  ) : (
                    <UserPlus size={16} />
                  )}
                  {profile.isFollowing ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            </div>

            <div className="flex gap-6 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => openList('followers')}
                className="text-left hover:opacity-80 transition"
              >
                <p className="font-bold">{profile.followerCount}</p>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  seguidores
                </p>
              </button>
              <button
                onClick={() => openList('following')}
                className="text-left hover:opacity-80 transition"
              >
                <p className="font-bold">{profile.followingCount}</p>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  seguindo
                </p>
              </button>
              <div>
                <p className="font-bold">{profile.postCount}</p>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
                  publicações
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <h3 className="font-bold flex items-center gap-2">
          <AtSign size={17} className="text-violet-600" /> Publicações
        </h3>
        {posts === null && (
          <div className="card p-5">
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {posts?.length === 0 && (
          <EmptyState
            icon={GraduationCap}
            title="Nenhuma publicação ainda"
            text={`${
              profile ? profile.name.split(' ')[0] : 'Este usuário'
            } ainda não publicou nada na comunidade.`}
          />
        )}
        {posts?.map((post) => (
          <SocialPostCard
            key={post.id}
            post={post}
            onDeleted={(deletedId) =>
              setPosts((current) => (current || []).filter((p) => p.id !== deletedId))
            }
          />
        ))}
      </div>

      {listOpen && (
        <div
          className="backdrop-in fixed inset-0 z-[80] bg-slate-950/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setListOpen(null)}
        >
          <div
            className="pop-in w-full max-w-sm bg-white dark:bg-[#14141a] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold">
                {listOpen === 'followers' ? 'Seguidores' : 'Seguindo'}
              </h4>
              <button
                onClick={() => setListOpen(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-3">
              {listLoading && <p className="muted text-sm text-center py-6">Carregando…</p>}
              {listUsers?.length === 0 && (
                <p className="muted text-sm text-center py-6">Ninguém aqui ainda.</p>
              )}
              {(listUsers || []).map((u) => (
                <Link
                  key={u.id}
                  to={`/perfil/${u.id}`}
                  onClick={() => setListOpen(null)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
                >
                  <UserAvatar name={u.name} avatar={u.avatar_path} size={34} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {u.role === 'PROFESSOR' ? 'Professor' : u.course || 'Aluno'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
