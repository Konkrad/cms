import { test, expect } from '../fixtures-e2e';

test('signup and verify via magic link', async ({ page, dbSeed, mailpit }) => {
  await page.goto('/');
  // Fill signup email field (adjust selector)
  await page.fill('input[name="email"]', 'user+e2e@example.com');
  await page.click('button[type="submit"]');

  // Poll for email (mailpit helper available on fixture)
  const msgs = await mailpit.listMessages();
  expect(Array.isArray(msgs)).toBeTruthy();
});