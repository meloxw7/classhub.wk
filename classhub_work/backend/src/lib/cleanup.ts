import { pool } from './db';
import { logger } from './logger';

export async function cleanupExpiredTokens(): Promise<void> {
  try {
    const refreshResult = await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL \'7 days\''
    );
    const passwordResetResult = await pool.query(
      'DELETE FROM password_resets WHERE expires_at < NOW() OR used_at < NOW() - INTERVAL \'7 days\''
    );
    const loginAttemptsResult = await pool.query(
      'DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL \'24 hours\''
    );
    logger.info({
      refreshTokens: refreshResult.rowCount,
      passwordResets: passwordResetResult.rowCount,
      loginAttempts: loginAttemptsResult.rowCount,
    }, 'Limpeza de tokens expirados concluída');
  } catch (error) {
    logger.error({ err: error }, 'Erro na limpeza de tokens expirados');
  }
}

export async function cleanupOldAuditLogs(): Promise<void> {
  try {
    const result = await pool.query(
      'DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL \'90 days\''
    );
    logger.info({ deleted: result.rowCount }, 'Limpeza de audit logs antiga concluída');
  } catch (error) {
    logger.error({ err: error }, 'Erro na limpeza de audit logs');
  }
}

if (require.main === module) {
  cleanupExpiredTokens()
    .then(() => cleanupOldAuditLogs())
    .then(() => {
      console.log('Limpeza concluída');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na limpeza:', error);
      process.exit(1);
    });
}