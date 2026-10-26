import bcrypt from 'bcryptjs';
import { pool } from './db';
import { logger } from './logger';

const ADMIN_EMAIL = 'melo@adm.com';
const ADMIN_PASSWORD = 'adm14082007';

let ensurePromise: Promise<void> | null = null;

export function ensureAdminSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await pool.query(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE'
      );
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await pool.query(
        `INSERT INTO users(name,email,password_hash,role,username,institution,is_admin)
         VALUES('Administrador',$1,$2,'PROFESSOR','admin','ClassHub',TRUE)
         ON CONFLICT (email) DO NOTHING`,
        [ADMIN_EMAIL, hash]
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
