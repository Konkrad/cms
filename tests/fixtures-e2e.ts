import { test as base } from '@playwright/test';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

type DbHelper = {
  getEventIdByTitle: (title: string) => string | null;
  getProductsByEventId: (eventId: string) => any[];
  getInventoryGroupsByEventId: (eventId: string) => any[];
};

type E2EFixtures = {
  dbSeed: null;
  db: DbHelper;
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, 'my-database.db');

export const test = base.extend<E2EFixtures>({
  dbSeed: async ({}, use) => {
    // Run seed script synchronously before tests
    const allow = process.env.E2E_ALLOW_DB_WRITE;
    if (!(allow === 'true' || allow === '1')) {
      throw new Error('E2E_ALLOW_DB_WRITE must be set to "true" or "1" to run e2e fixtures');
    }
    execSync('node ./scripts/run-seed.js', { stdio: 'inherit' });
    await use(null);
  },

  db: async ({}, use) => {
    const sqlite = new Database(DB_PATH, { readonly: true });
    const helper: DbHelper = {
      getEventIdByTitle(title: string) {
        const row = sqlite.prepare('SELECT id FROM events WHERE title = ? ORDER BY created_at DESC LIMIT 1').get(title) as { id: string } | undefined;
        return row ? row.id : null;
      },
      getProductsByEventId(eventId: string) {
        return sqlite.prepare('SELECT * FROM products WHERE event_id = ?').all(eventId);
      },
      getInventoryGroupsByEventId(eventId: string) {
        return sqlite.prepare('SELECT * FROM inventory_groups WHERE event_id = ?').all(eventId);
      },
    };
    await use(helper);
    sqlite.close();
  },
});

export { expect } from '@playwright/test';