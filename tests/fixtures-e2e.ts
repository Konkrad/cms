import { test as base } from '@playwright/test';
import { execSync } from 'child_process';
import { startStripeMock, stopStripeMock } from './utils/stripe-mock';
import Database from 'better-sqlite3';

export const test = base.extend({
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
    const DB_PATH = './my-database.db';
    const sqlite = new Database(DB_PATH, { readonly: true });
    const helper = {
      getEventIdByTitle(title: string) {
        const row = sqlite.prepare('SELECT id FROM events WHERE title = ? ORDER BY created_at DESC LIMIT 1').get(title);
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

  stripeMock: async ({}, use) => {
    const proc = await startStripeMock();
    await use(proc);
    stopStripeMock();
  },
});

export { expect } from '@playwright/test';