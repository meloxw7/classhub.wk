import bcrypt from 'bcryptjs';
import { pool } from './db';
import { logger } from './logger';

export function getAdminCredentials(): { email: string; password: string } {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    if (process.env.NODE_ENV === 'production')
      throw new Error(
        'ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórias em produção. Defina no arquivo .env.'
      );
    return { email: 'admin@dev.classhub', password: 'admin-dev-only' };
  }
  return { email, password };
}

let ensurePromise: Promise<void> | null = null;

export function ensureAdminSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const { email, password } = getAdminCredentials();
      await pool.query(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE'
      );
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO users(name,email,password_hash,role,username,institution,is_admin)
         VALUES('Administrador',$1,$2,'PROFESSOR','admin','ClassHub',TRUE)
         ON CONFLICT (email) DO NOTHING`,
        [email, hash]
      );
    })().catch((error) => {
      ensurePromise = null;
      logger.error({ err: error }, 'Falha na migração/seed do administrador');
      throw error;
    });
  }
  return ensurePromise;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT is_admin FROM users WHERE id=$1', [userId]);
    return !!r.rows[0]?.is_admin;
  } catch {
    return false;
  }
}
