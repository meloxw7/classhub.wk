import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
import { notifyUsers } from '../lib/notify';
import { logger } from '../lib/logger';
import { ensureUsernameSchema } from '../lib/username';
const router = Router();
router.use(auth);
const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS social_likes (
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(post_id, user_id)
);
CREATE TABLE IF NOT EXISTS social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON social_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(300);
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS poll_options TEXT[];
CREATE TABLE IF NOT EXISTS social_poll_votes (
  post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_poll_votes_post ON social_poll_votes(post_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(20);
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS repost_material_id UUID REFERENCES materials(id) ON DELETE SET NULL;
ALTER TABLE social_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES social_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_social_comments_parent ON social_comments(parent_id);
`;
let schemaPromise: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool
      .query(ENSURE_SQL)
      .then(() => ensureUsernameSchema())
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
router.use((_req, res, next) => {
  ensureSchema().then(next).catch((error) => {
    logger.error({ err: error }, 'Falha ao preparar tabelas sociais');
    res.status(500).json({ message: 'Recurso social indisponível' });
  });
});
const MAX_CONTENT = 500;
const MENTION_RE = /@([a-z0-9_]{3,20})/gi;
function extractMentions(content: string): string[] {
  const set = new Set<string>();
  for (const m of String(content || '').matchAll(MENTION_RE)) set.add(m[1].toLowerCase());
  return [...set].slice(0, 10);
}
async function resolveMentions(tokens: string[]): Promise<Map<string, { id: string }>> {
  const map = new Map<string, { id: string }>();
  if (!tokens.length) return map;
  const r = await pool.query('SELECT id,username FROM users WHERE username = ANY($1::text[])', [
    tokens,
  ]);
  for (const row of r.rows) map.set(row.username, { id: row.id });
  return map;
}
async function notifyMentions(
  content: string,
  authorName: string,
  exclude: string[],
  kind: 'post' | 'comment'
) {
  const tokens = extractMentions(content);
  if (!tokens.length) return;
  const map = await resolveMentions(tokens);
  const ids = [...map.values()]
    .map((v) => v.id)
    .filter((id) => !exclude.includes(id));
  if (!ids.length) return;
  const label =
    kind === 'post' ? 'mencionou você em uma publicação' : 'mencionou você em um comentário';
  notifyUsers(ids, 'Menção', `${authorName} ${label}.`, 'SOCIAL').catch(() => {});
}
async function enrichMentions<
  T extends { content: string; mentions?: { username: string; id: string }[] },
>(items: T[]): Promise<T[]> {
  const all = new Set<string>();
  for (const item of items) for (const t of extractMentions(item.content)) all.add(t);
  const map = await resolveMentions([...all]);
  for (const item of items) {
    item.mentions = extractMentions(item.content)
      .filter((t) => map.has(t))
      .map((t) => ({ username: t, id: map.get(t)!.id }));
  }
  return items;
}
function toPost(row: any) {
  const pollCounts: Record<string, number> = {};
  if (row.poll_counts) {
    for (const [key, value] of Object.entries(row.poll_counts)) pollCounts[key] = Number(value);
  }
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name,
      username: row.author_username,
      avatar_path: row.author_avatar,
      role: row.author_role,
    },
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    likedByMe: row.liked_by_me,
    pollOptions: row.poll_options || null,
    pollCounts,
    pollTotal: Number(row.poll_total || 0),
    myVote: row.my_vote === null || row.my_vote === undefined ? null : Number(row.my_vote),
    repost: row.repost_material_id
      ? {
          materialId: row.repost_material_id,
          title: row.repost_title,
          subjectId: row.repost_subject_id,
          type: row.repost_type,
        }
      : null,
  };
}
const POST_SELECT = `
  SELECT p.id,p.author_id,p.content,p.created_at,p.poll_options,p.repost_material_id,
    u.name author_name,u.username author_username,u.avatar_path author_avatar,u.role author_role,
    rm.title repost_title,rm.subject_id repost_subject_id,rm.type repost_type,
    (SELECT COUNT(*) FROM social_likes l WHERE l.post_id=p.id) like_count,
    (SELECT COUNT(*) FROM social_comments c WHERE c.post_id=p.id) comment_count,
    EXISTS(SELECT 1 FROM social_likes l WHERE l.post_id=p.id AND l.user_id=$1) liked_by_me,
    (SELECT v.option_index FROM social_poll_votes v WHERE v.post_id=p.id AND v.user_id=$1) my_vote,
    (SELECT json_object_agg(t.option_index,t.n) FROM (SELECT option_index,COUNT(*)::int n FROM social_poll_votes WHERE post_id=p.id GROUP BY option_index) t) poll_counts,
    (SELECT COUNT(*) FROM social_poll_votes v WHERE v.post_id=p.id) poll_total
  FROM social_posts p JOIN users u ON u.id=p.author_id
  LEFT JOIN materials rm ON rm.id=p.repost_material_id`;
router.get('/feed', async (req: AuthRequest, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const r = await pool.query(
    `${POST_SELECT} WHERE p.author_id=$1 OR p.author_id IN (SELECT following_id FROM follows WHERE follower_id=$1) ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
    [req.user!.id, limit, offset]
  );
  res.json(await enrichMentions(r.rows.map(toPost)));
});
router.get('/suggestions', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT id,name,username,avatar_path,role,course FROM users
     WHERE id<>$1 AND id NOT IN (SELECT following_id FROM follows WHERE follower_id=$1)
     ORDER BY created_at DESC LIMIT 6`,
    [req.user!.id]
  );
  res.json(r.rows);
});
router.post('/posts', async (req: AuthRequest, res) => {
  const content = String(req.body?.content || '').trim();
  const rawOptions = req.body?.pollOptions;
  const materialId = req.body?.materialId ? String(req.body.materialId) : null;
  if (!content && !materialId)
    return res.status(400).json({ message: 'Escreva algo para publicar' });
  if (content.length > MAX_CONTENT)
    return res.status(400).json({ message: `Máximo de ${MAX_CONTENT} caracteres` });
  if (materialId) {
    const m = await pool.query('SELECT 1 FROM materials WHERE id=$1', [materialId]);
    if (!m.rowCount) return res.status(400).json({ message: 'Material inválido' });
  }
  let pollOptions: string[] | null = null;
  if (Array.isArray(rawOptions)) {
    pollOptions = rawOptions.map((o: any) => String(o || '').trim()).filter(Boolean);
    if (pollOptions.length < 2 || pollOptions.length > 5)
      return res.status(400).json({ message: 'Enquete precisa de 2 a 5 opções' });
    if (pollOptions.some((o) => o.length > 80))
      return res.status(400).json({ message: 'Opções da enquete: máximo de 80 caracteres' });
  }
  const r = await pool.query(
    `INSERT INTO social_posts(author_id,content,poll_options,repost_material_id) VALUES($1,$2,$3,$4)
     RETURNING id,author_id,content,created_at,poll_options,repost_material_id,
       (SELECT name FROM users WHERE id=$1) author_name,
       (SELECT username FROM users WHERE id=$1) author_username,
       (SELECT avatar_path FROM users WHERE id=$1) author_avatar,
       (SELECT role FROM users WHERE id=$1) author_role`,
    [req.user!.id, content, pollOptions, materialId]
  );
  const row = r.rows[0];
  if (materialId) {
    const m = await pool.query('SELECT title,subject_id,type FROM materials WHERE id=$1', [
      materialId,
    ]);
    row.repost_title = m.rows[0]?.title;
    row.repost_subject_id = m.rows[0]?.subject_id;
    row.repost_type = m.rows[0]?.type;
  }
  notifyMentions(content, req.user!.name, [req.user!.id], 'post');
  res.status(201).json(
    toPost({
      ...row,
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
      my_vote: null,
      poll_counts: null,
      poll_total: 0,
    })
  );
});
router.post('/posts/:id/vote', async (req: AuthRequest, res) => {
  const optionIndex = Number(req.body?.optionIndex);
  if (!Number.isInteger(optionIndex) || optionIndex < 0)
    return res.status(400).json({ message: 'Opção inválida' });
  const post = await pool.query('SELECT id,poll_options FROM social_posts WHERE id=$1', [
    req.params.id,
  ]);
  if (!post.rowCount) return res.status(404).json({ message: 'Publicação não encontrada' });
  const options = post.rows[0].poll_options || [];
  if (!options.length)
    return res.status(400).json({ message: 'Esta publicação não é uma enquete' });
  if (optionIndex >= options.length)
    return res.status(400).json({ message: 'Opção inválida' });
  await pool.query(
    `INSERT INTO social_poll_votes(post_id,user_id,option_index) VALUES($1,$2,$3)
     ON CONFLICT (post_id,user_id) DO UPDATE SET option_index=$3`,
    [req.params.id, req.user!.id, optionIndex]
  );
  const counts = await pool.query(
    `SELECT option_index,COUNT(*)::int n FROM social_poll_votes WHERE post_id=$1 GROUP BY option_index`,
    [req.params.id]
  );
  const total = await pool.query(
    'SELECT COUNT(*)::int n FROM social_poll_votes WHERE post_id=$1',
    [req.params.id]
  );
  const pollCounts: Record<string, number> = {};
  for (const row of counts.rows) pollCounts[String(row.option_index)] = row.n;
  res.json({ myVote: optionIndex, pollCounts, pollTotal: total.rows[0].n });
});
router.delete('/posts/:id', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'DELETE FROM social_posts WHERE id=$1 AND author_id=$2 RETURNING id',
    [req.params.id, req.user!.id]
  );
  if (!r.rowCount) return res.status(404).json({ message: 'Publicação não encontrada' });
  res.json({ ok: true });
});
router.post('/posts/:id/like', async (req: AuthRequest, res) => {
  const post = await pool.query('SELECT id,author_id FROM social_posts WHERE id=$1', [
    req.params.id,
  ]);
  if (!post.rowCount) return res.status(404).json({ message: 'Publicação não encontrada' });
  const existing = await pool.query(
    'SELECT 1 FROM social_likes WHERE post_id=$1 AND user_id=$2',
    [req.params.id, req.user!.id]
  );
  let liked: boolean;
  if (existing.rowCount) {
    await pool.query('DELETE FROM social_likes WHERE post_id=$1 AND user_id=$2', [
      req.params.id,
      req.user!.id,
    ]);
    liked = false;
  } else {
    await pool.query('INSERT INTO social_likes(post_id,user_id) VALUES($1,$2)', [
      req.params.id,
      req.user!.id,
    ]);
    liked = true;
    if (post.rows[0].author_id !== req.user!.id) {
      notifyUsers(
        [post.rows[0].author_id],
        'Nova curtida',
        `${req.user!.name} curtiu sua publicação.`,
        'SOCIAL'
      ).catch(() => {});
    }
  }
  const count = await pool.query(
    'SELECT COUNT(*)::int n FROM social_likes WHERE post_id=$1',
    [req.params.id]
  );
  res.json({ liked, likeCount: count.rows[0].n });
});
router.get('/posts/:id/comments', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT c.id,c.post_id,c.content,c.created_at,c.author_id,c.parent_id,
       u.name author_name,u.username author_username,u.avatar_path author_avatar,u.role author_role
     FROM social_comments c JOIN users u ON u.id=c.author_id
     WHERE c.post_id=$1 ORDER BY c.created_at ASC`,
    [req.params.id]
  );
  res.json(
    await enrichMentions(
      r.rows.map((row: any) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        parentId: row.parent_id,
        author: {
          id: row.author_id,
          name: row.author_name,
          username: row.author_username,
          avatar_path: row.author_avatar,
          role: row.author_role,
        },
      }))
    )
  );
});
router.post('/posts/:id/comments', async (req: AuthRequest, res) => {
  const content = String(req.body?.content || '').trim();
  const parentId = req.body?.parentId ? String(req.body.parentId) : null;
  if (!content) return res.status(400).json({ message: 'Comentário obrigatório' });
  if (content.length > MAX_CONTENT)
    return res.status(400).json({ message: `Máximo de ${MAX_CONTENT} caracteres` });
  const post = await pool.query('SELECT id,author_id FROM social_posts WHERE id=$1', [
    req.params.id,
  ]);
  if (!post.rowCount) return res.status(404).json({ message: 'Publicação não encontrada' });
  if (parentId) {
    const parent = await pool.query(
      'SELECT id,author_id FROM social_comments WHERE id=$1 AND post_id=$2',
      [parentId, req.params.id]
    );
    if (!parent.rowCount)
      return res.status(400).json({ message: 'Comentário de origem inválido' });
  }
  const r = await pool.query(
    'INSERT INTO social_comments(post_id,author_id,content,parent_id) VALUES($1,$2,$3,$4) RETURNING *',
    [req.params.id, req.user!.id, content, parentId]
  );
  const parentAuthor = parentId
    ? await pool.query('SELECT author_id FROM social_comments WHERE id=$1', [parentId])
    : null;
  if (parentAuthor?.rowCount && parentAuthor.rows[0].author_id !== req.user!.id) {
    notifyUsers(
      [parentAuthor.rows[0].author_id],
      'Resposta',
      `${req.user!.name} respondeu seu comentário na comunidade.`,
      'SOCIAL'
    ).catch(() => {});
  } else if (!parentId && post.rows[0].author_id !== req.user!.id) {
    notifyUsers(
      [post.rows[0].author_id],
      'Novo comentário',
      `${req.user!.name} comentou na sua publicação.`,
      'SOCIAL'
    ).catch(() => {});
  }
  notifyMentions(content, req.user!.name, [req.user!.id], 'comment');
  const me = await pool.query('SELECT username FROM users WHERE id=$1', [req.user!.id]);
  res.status(201).json({
    id: r.rows[0].id,
    content: r.rows[0].content,
    createdAt: r.rows[0].created_at,
    parentId: r.rows[0].parent_id,
    author: {
      id: req.user!.id,
      name: req.user!.name,
      username: me.rows[0]?.username,
      avatar_path: null,
      role: req.user!.role,
    },
    mentions: [],
  });
});
router.delete('/comments/:id', async (req: AuthRequest, res) => {
  const r = await pool.query(
    'DELETE FROM social_comments WHERE id=$1 AND author_id=$2 RETURNING id',
    [req.params.id, req.user!.id]
  );
  if (!r.rowCount) return res.status(404).json({ message: 'Comentário não encontrado' });
  res.json({ ok: true });
});
router.post('/users/:id/follow', async (req: AuthRequest, res) => {
  const target = String(req.params.id);
  if (target === req.user!.id)
    return res.status(400).json({ message: 'Você não pode seguir a si mesmo' });
  const exists = await pool.query('SELECT 1 FROM users WHERE id=$1', [target]);
  if (!exists.rowCount) return res.status(404).json({ message: 'Usuário não encontrado' });
  const current = await pool.query(
    'SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2',
    [req.user!.id, target]
  );
  let following: boolean;
  if (current.rowCount) {
    await pool.query('DELETE FROM follows WHERE follower_id=$1 AND following_id=$2', [
      req.user!.id,
      target,
    ]);
    following = false;
  } else {
    await pool.query('INSERT INTO follows(follower_id,following_id) VALUES($1,$2)', [
      req.user!.id,
      target,
    ]);
    following = true;
    notifyUsers(
      [target],
      'Novo seguidor',
      `${req.user!.name} começou a seguir você.`,
      'SOCIAL'
    ).catch(() => {});
  }
  const count = await pool.query(
    'SELECT COUNT(*)::int n FROM follows WHERE following_id=$1',
    [target]
  );
  res.json({ following, followerCount: count.rows[0].n });
});
router.get('/users/:id', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT u.id,u.name,u.username,u.role,u.avatar_path,u.course,u.semester,u.institution,u.bio,
      (SELECT COUNT(*)::int FROM follows WHERE following_id=u.id) follower_count,
      (SELECT COUNT(*)::int FROM follows WHERE follower_id=u.id) following_count,
      (SELECT COUNT(*)::int FROM social_posts WHERE author_id=u.id) post_count,
      EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=u.id) is_following,
      EXISTS(SELECT 1 FROM follows WHERE follower_id=u.id AND following_id=$2) is_follower,
      (SELECT COUNT(*)::int FROM material_progress mp WHERE mp.user_id=u.id AND mp.completed) completed_materials,
      (SELECT COUNT(*)::int FROM study_posts sp WHERE sp.author_id=u.id) study_posts_count
     FROM users u WHERE u.id=$1`,
    [req.params.id, req.user!.id]
  );
  if (!r.rowCount) return res.status(404).json({ message: 'Usuário não encontrado' });
  const row = r.rows[0];
  const completedMaterials = Number(row.completed_materials);
  const studyPostsCount = Number(row.study_posts_count);
  const badges: { id: string; label: string; description: string }[] = [];
  if (completedMaterials >= 10)
    badges.push({
      id: 'LEITOR',
      label: 'Leitor dedicado',
      description: 'Concluiu 10 ou mais materiais',
    });
  if (studyPostsCount >= 10)
    badges.push({
      id: 'COLABORADOR',
      label: 'Colaborador',
      description: '10 ou mais publicações em salas de estudo',
    });
  res.json({
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    avatar_path: row.avatar_path,
    course: row.course,
    semester: row.semester,
    institution: row.institution,
    bio: row.bio,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    postCount: row.post_count,
    isFollowing: row.is_following,
    isFollower: row.is_follower,
    badges,
  });
});
router.get('/users/:id/posts', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `${POST_SELECT} WHERE p.author_id=$2 ORDER BY p.created_at DESC LIMIT 200`,
    [req.user!.id, req.params.id]
  );
  res.json(await enrichMentions(r.rows.map(toPost)));
});
function userCards(rows: any[]) {
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    username: row.username,
    avatar_path: row.avatar_path,
    role: row.role,
    course: row.course,
  }));
}
router.get('/users/:id/followers', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT u.id,u.name,u.username,u.avatar_path,u.role,u.course FROM users u
     JOIN follows f ON f.follower_id=u.id WHERE f.following_id=$1 ORDER BY f.created_at DESC`,
    [req.params.id]
  );
  res.json(userCards(r.rows));
});
router.get('/users/:id/following', async (req: AuthRequest, res) => {
  const r = await pool.query(
    `SELECT u.id,u.name,u.username,u.avatar_path,u.role,u.course FROM users u
     JOIN follows f ON f.following_id=u.id WHERE f.follower_id=$1 ORDER BY f.created_at DESC`,
    [req.params.id]
  );
  res.json(userCards(r.rows));
});
export default router;
