import { test as base } from '@playwright/test';
import { execSync } from 'child_process';
import { startStripeMock, stopStripeMock } from './utils/stripe-mock';
import { listMessages } from './utils/mailpit-client';

export const test = base.extend({
  dbSeed: async ({}, use) => {
    // Run seed script synchronously before tests
    if (process.env.E2E_ALLOW_DB_WRITE !== 'true') {
      throw new Error('E2E_ALLOW_DB_WRITE must be set to "true" to run e2e fixtures');
    }
    execSync('node ./scripts/run-seed.js', { stdio: 'inherit' });
    await use(null);
  },

  stripeMock: async ({}, use) => {
    const proc = startStripeMock();
    await use(proc);
    stopStripeMock();
  },

  mailpit: async ({}, use) => {
    // Ensure mailpit is reachable
    await use({ listMessages });
  }
});

export { expect } from '@playwright/test';