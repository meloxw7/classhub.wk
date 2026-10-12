import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida. Configure backend/.env (veja .env.example).');
  process.exit(1);
}

const files = [resolve('..', 'database', 'schema.sql'), resolve('..', 'database', 'seed.sql')];

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  for (const file of files) {
    process.stdout.write(`Aplicando ${file} ... `);
    await client.query(readFileSync(file, 'utf8'));
    console.log('ok');
  }
  console.log('Banco ClassHub inicializado com sucesso.');
} catch (error) {
  console.error('Falha ao inicializar o banco:', error?.message || error);
  process.exit(1);
} finally {
  await client.end();
}
