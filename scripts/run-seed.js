import fs from 'fs';
import Database from 'better-sqlite3';

const DB_PATH = './my-database.db';
const SQL_PATH = './scripts/seed-test-data.sql';

if (process.env.E2E_ALLOW_DB_WRITE !== 'true') {
  console.error('E2E_ALLOW_DB_WRITE is not set to "true" — aborting to prevent accidental DB writes.');
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database file not found at ${DB_PATH}.`);
  process.exit(1);
}

if (!fs.existsSync(SQL_PATH)) {
  console.error(`Seed SQL file not found at ${SQL_PATH}. Create it with the required INSERTs.`);
  process.exit(1);
}

const sql = fs.readFileSync(SQL_PATH, 'utf8');
const db = new Database(DB_PATH);

try {
  db.exec('BEGIN');
  // Naive split by semicolon — keep seeds idempotent and single-statement per line if possible.
  const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    db.exec(stmt);
  }
  db.exec('COMMIT');
  console.log('Seeded test data into', DB_PATH);
} catch (err) {
  console.error('Seeding failed:', err);
  try { db.exec('ROLLBACK'); } catch(e){}
  process.exit(1);
} finally {
  db.close();
}