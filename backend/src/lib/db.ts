import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (error) => {
  console.error('Erro inativo no pool do PostgreSQL:', error);
});
