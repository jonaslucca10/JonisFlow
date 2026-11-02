/**
 * Criar database e aplicar schema.sql (PostgreSQL).
 *   npm run apply-schema
 * Útil onde não há psql (ex.: embedded postgres em dev/CI).
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://jonis@127.0.0.1:5432/jonisflow';
const [proto, user, pass, hostport, db] = new URL(DATABASE_URL).hostname.length ? [null, null, null, null, null] : [null, null, null, null, null]; // placeholder
const parsed = DATABASE_URL.match(/^postgresql(?:\+(?:pg|prisma))?:\/\/([^:]+)(?::([^@]+))?@([^:/]+)(?::(\d+))?\/(.+)/);
if (!parsed) throw new Error('DATABASE_URL inválida');
const [, userName, passWord, host, port, database] = parsed;

const admin = new pg.Client({ host, port: Number(port || 5432), user: userName, password: passWord, database: 'postgres' });
await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  console.log(`database ${database} criado`);
} catch (e) {
  if (!/exists/i.test(e.message)) throw e;
}
await admin.end();

const c = new pg.Client({ host, port: Number(port || 5432), user: userName, password: passWord, database });
await c.connect();
const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
await c.query(sql);
await c.end();
console.log(`schema.sql aplicado em ${database}`);
