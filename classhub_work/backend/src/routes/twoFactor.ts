import { Router } from 'express';
import { pool } from '../lib/db';
import { auth, AuthRequest } from '../middleware/auth';
import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  generateBackupCodes,
  enableTwoFactor,
  disableTwoFactor,
  consumeBackupCode,
  getTwoFactorStatus,
} from '../lib/twoFactor';
import { validate, twoFactorVerifySchema, twoFactorDisableSchema } from '../lib/validation';

const router = Router();
router.use(auth);

router.get('/2fa/status', async (req: AuthRequest, res) => {
  const status = await getTwoFactorStatus(req.user!.id);
  res.json(status);
});

router.post('/2fa/setup', async (req: AuthRequest, res) => {
  const status = await getTwoFactorStatus(req.user!.id);
  if (status.enabled) {
    return res.status(400).json({ message: '2FA já está ativado. Desative primeiro para reconfigurar.' });
  }
  const { secret, otpauthUrl } = generateTwoFactorSecret(req.user!.email);
  await pool.query('UPDATE users SET two_factor_secret = $1 WHERE id = $2', [secret, req.user!.id]);
  res.json({ secret, otpauthUrl });
});

router.post('/2fa/enable', validate(twoFactorVerifySchema), async (req: AuthRequest, res) => {
  const { token, backupCode } = req.body;
  const r = await pool.query('SELECT two_factor_secret FROM users WHERE id = $1', [req.user!.id]);
  if (!r.rowCount || !r.rows[0].two_factor_secret) {
    return res.status(400).json({ message: 'Configure o 2FA primeiro (GET /2fa/setup)' });
  }
  const secret = r.rows[0].two_factor_secret;
  let verified = false;
  if (token) verified = verifyTwoFactorToken(secret, token);
  else if (backupCode) verified = await consumeBackupCode(req.user!.id, backupCode);
  if (!verified) return res.status(401).json({ message: 'Código inválido' });
  const backupCodes = generateBackupCodes();
  await enableTwoFactor(req.user!.id, secret, backupCodes);
  res.json({ backupCodes });
});

router.post('/2fa/disable', validate(twoFactorDisableSchema), async (req: AuthRequest, res) => {
  const { token } = req.body;
  const r = await pool.query('SELECT two_factor_secret FROM users WHERE id = $1', [req.user!.id]);
  if (!r.rowCount || !r.rows[0].two_factor_secret) {
    return res.status(400).json({ message: '2FA não configurado' });
  }
  const secret = r.rows[0].two_factor_secret;
  if (!verifyTwoFactorToken(secret, token)) {
    return res.status(401).json({ message: 'Código inválido' });
  }
  await disableTwoFactor(req.user!.id);
  res.json({ ok: true });
});

router.post('/2fa/verify', validate(twoFactorVerifySchema), async (req: AuthRequest, res) => {
  const { token, backupCode } = req.body;
  const r = await pool.query('SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1', [req.user!.id]);
  if (!r.rowCount || !r.rows[0].two_factor_enabled) {
    return res.status(400).json({ message: '2FA não está ativado' });
  }
  const { two_factor_secret: secret } = r.rows[0];
  let verified = false;
  if (token) verified = verifyTwoFactorToken(secret, token);
  else if (backupCode) verified = await consumeBackupCode(req.user!.id, backupCode);
  if (!verified) return res.status(401).json({ message: 'Código inválido ou código de backup já usado' });
  res.json({ ok: true, backupCodeUsed: !!backupCode });
});

router.get('/2fa/backup-codes', async (req: AuthRequest, res) => {
  const r = await pool.query('SELECT two_factor_backup_codes FROM users WHERE id = $1 AND two_factor_enabled = TRUE', [req.user!.id]);
  if (!r.rowCount) {
    return res.status(400).json({ message: '2FA não está ativado' });
  }
  res.json({ backupCodes: r.rows[0].two_factor_backup_codes || [] });
});

router.post('/2fa/regenerate-backup-codes', validate(twoFactorDisableSchema), async (req: AuthRequest, res) => {
  const { token } = req.body;
  const r = await pool.query('SELECT two_factor_secret FROM users WHERE id = $1', [req.user!.id]);
  if (!r.rowCount || !r.rows[0].two_factor_secret) {
    return res.status(400).json({ message: '2FA não configurado' });
  }
  const secret = r.rows[0].two_factor_secret;
  if (!verifyTwoFactorToken(secret, token)) {
    return res.status(401).json({ message: 'Código inválido' });
  }
  const backupCodes = generateBackupCodes();
  await pool.query('UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2', [backupCodes, req.user!.id]);
  res.json({ backupCodes });
});

export default router;