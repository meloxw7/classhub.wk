import { pool } from './db';
import { logger } from './logger';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function slugifyUsername(name: string): string {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 14);
  return base || 'aluno';
}

export async function uniqueUsername(name: string): Promise<string> {
  const base = slugifyUsername(name);
  const r = await pool.query('SELECT username FROM users WHERE username LIKE $1', [base + '%']);
  const taken = new Set(r.rows.map((x: any) => x.username));
  if (!taken.has(base)) return base;
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}${i}`.slice(0, 20);
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}${Date.now().toString(36).slice(-5)}`.slice(0, 20);
}

let ensurePromise: Promise<void> | null = null;

export function ensureUsernameSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(20)');
      const nulls = await pool.query(
        'SELECT id,name FROM users WHERE username IS NULL ORDER BY created_at ASC'
      );
      for (const u of nulls.rows) {
        const username = await uniqueUsername(u.name);
        await pool.query('UPDATE users SET username=$1 WHERE id=$2 AND username IS NULL', [
          username,
          u.id,
        ]);
      }
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    })().catch((error) => {
      ensurePromise = null;
      logger.error({ err: error }, 'Falha na migração de usernames');
      throw error;
    });
  }
  return ensurePromise;
}
