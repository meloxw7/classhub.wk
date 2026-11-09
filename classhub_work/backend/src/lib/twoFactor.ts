import speakeasy from 'speakeasy';
import { pool } from './db';

export function generateTwoFactorSecret(userEmail: string): { secret: string; otpauthUrl: string } {
  const secret = speakeasy.generateSecret({
    name: `ClassHub (${userEmail})`,
    issuer: 'ClassHub',
    length: 20,
  });
  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url || '',
  };
}

export function verifyTwoFactorToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  return codes;
}

export async function enableTwoFactor(userId: string, secret: string, backupCodes: string[]): Promise<void> {
  await pool.query(
    'UPDATE users SET two_factor_secret = $1, two_factor_enabled = TRUE, two_factor_backup_codes = $2 WHERE id = $3',
    [secret, backupCodes, userId]
  );
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = FALSE, two_factor_backup_codes = NULL WHERE id = $1',
    [userId]
  );
}

export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const normalizedCode = code.toUpperCase().replace(/-/g, '');
  const r = await pool.query(
    'SELECT two_factor_backup_codes FROM users WHERE id = $1 AND two_factor_enabled = TRUE',
    [userId]
  );
  if (!r.rowCount) return false;
  const codes: string[] = r.rows[0].two_factor_backup_codes || [];
  const index = codes.findIndex((c) => c.replace(/-/g, '') === normalizedCode);
  if (index === -1) return false;
  codes.splice(index, 1);
  await pool.query(
    'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
    [codes, userId]
  );
  return true;
}

export async function getTwoFactorStatus(userId: string): Promise<{ enabled: boolean; hasSecret: boolean }> {
  const r = await pool.query(
    'SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = $1',
    [userId]
  );
  if (!r.rowCount) return { enabled: false, hasSecret: false };
  return {
    enabled: r.rows[0].two_factor_enabled,
    hasSecret: !!r.rows[0].two_factor_secret,
  };
}