import { test as base } from '@playwright/test';
import { execSync } from 'child_process';
import { startStripeMock, stopStripeMock } from './utils/stripe-mock';

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

  stripeMock: async ({}, use) => {
    const proc = await startStripeMock();
    await use(proc);
    stopStripeMock();
  },
});

export { expect } from '@playwright/test';