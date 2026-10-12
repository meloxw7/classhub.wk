import pg from 'pg';
import dotenv from 'dotenv';
import { logger } from './logger';
dotenv.config();
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (error) => {
  logger.error({ err: error }, 'Erro inativo no pool do PostgreSQL');
});
