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

// Prefer running the TypeScript seed script which creates a richer set of test data
try {
  console.log('Running TypeScript seed script via npx tsx scripts/seed.ts');
  const out = execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
  console.log('Seed complete');
} catch (err) {
  console.error('Seeding failed:', err);
  process.exit(1);
}