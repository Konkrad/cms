import { execSync } from 'child_process';
import fs from 'fs';

const DB_PATH = './my-database.db';

try {
  console.log('Applying DB schema with drizzle-kit push (dev)');
  execSync('npx --yes drizzle-kit push --config drizzle.config.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('drizzle-kit push failed:', err);
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database file not found at ${DB_PATH} after running drizzle-kit push.`);
  process.exit(1);
}

// Run lightweight local dev test-data creator
try {
  console.log('Running local dev test-data creator: scripts/create-test-data.ts');
  execSync('npx tsx scripts/create-test-data.ts', { stdio: 'inherit' });
  console.log('Local dev data created');
} catch (err) {
  console.error('Creating local dev data failed:', err);
  process.exit(1);
}

console.log('Dev seeding complete');
import fs from 'fs';
import { execSync } from 'child_process';

const DB_PATH = './my-database.db';

if (process.env.DEV_ALLOW_DB_WRITE !== 'true') {
  console.error('DEV_ALLOW_DB_WRITE is not set to "true" — aborting to prevent accidental DB writes.');
  process.exit(1);
}

try {
  console.log('Applying DB schema with drizzle-kit push');
  execSync('npx --yes drizzle-kit push --config drizzle.config.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('drizzle-kit push failed:', err);
  process.exit(1);
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database file not found at ${DB_PATH} after running drizzle-kit push.`);
  process.exit(1);
}

// Run the richer TS seeder first (idempotent in parts)
try {
  console.log('Running TypeScript full seeder: scripts/seed.ts');
  execSync('npx tsx scripts/seed.ts', { stdio: 'inherit' });
} catch (err) {
  console.error('Seeding (seed.ts) failed:', err);
  process.exit(1);
}

// Then run the dev-only small data generator
try {
  console.log('Running dev test-data creator: scripts/create-test-data.ts');
  execSync('npx tsx scripts/create-test-data.ts', { stdio: 'inherit' });
  console.log('Dev seed complete');
} catch (err) {
  console.error('Dev seeding failed:', err);
  process.exit(1);
}
import { execSync } from 'child_process';
import fs from 'fs';

const DB_PATH = './my-database.db';

// Runner for local development. Does NOT require E2E guard.
(async function runDevSeed() {
  try {
    console.log('Applying DB schema with drizzle-kit push (dev)');
    execSync('npx --yes drizzle-kit push --config drizzle.config.ts', { stdio: 'inherit' });
  } catch (err) {
    console.error('drizzle-kit push failed:', err);
    process.exit(1);
  }

  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database file not found at ${DB_PATH} after running drizzle-kit push.`);
    process.exit(1);
  }

  try {
    console.log('Running local dev test-data generator via npx tsx scripts/create-test-data.ts');
    execSync('npx tsx scripts/create-test-data.ts', { stdio: 'inherit' });
    console.log('Local dev test data created');
  } catch (err) {
    console.error('Local dev seeding failed:', err);
    process.exit(1);
  }
})();
