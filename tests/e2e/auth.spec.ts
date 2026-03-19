import { test, expect } from '../fixtures-e2e';
import { waitForEmailHtml, extractAllLinks } from '../utils/mailpit-client';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}+${Date.now()}@example.com`;
}

function extractOtpFromEmailHtml(html: string) {
  // The email includes both a magic link and a 6-letter code. We want the code.
  // It appears after the phrase "Or enter this code:". Avoid matching inside
  // HTML attributes (e.g. 'line-height') by capturing a 6-char token that
  // appears as element text (between `>` and `<`).
  const marker = 'Or enter this code:';
  const start = html.indexOf(marker);
  const searchArea = start >= 0 ? html.slice(start) : html;

  // Look for a 6-char code that is element text: >PCDMYN<
  let match = searchArea.match(/>([A-Z0-9]{6})</i);
  if (match) return match[1];

  // Fallback: first 6-char alphanumeric sequence after the marker
  match = searchArea.match(/([A-Z0-9]{6})/i);
  return match?.[1] ?? null;
}

test('login works via 6-letter code', async ({ page }) => {
  const email = uniqueEmail('code');

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.click('button[type="submit"]');

  // Wait for the form to switch to the code verification step (use input presence)
  await page.waitForSelector('input[maxlength="6"]', { timeout: 15000 });

  const html = await waitForEmailHtml(email);
  const code = extractOtpFromEmailHtml(html);
  console.log('[DEBUG] Extracted OTP code:', code);
  expect(code).toBeTruthy();

  await page.locator('input[maxlength="6"]').fill(code as string);
  await page.click('button[type="submit"]');

  // Give the client a moment to process the server-side redirect/session
  // and assert the authenticated UI appears (avoid hitting the profile loader
  // which can trigger DB queries in the test environment).
  await page.waitForTimeout(500);
  await expect(page.locator('[aria-label="profile-menu"]')).toBeVisible({ timeout: 15000 });
});

test('login works via magic link', async ({ page }) => {
  const email = uniqueEmail('link');

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.click('button[type="submit"]');

  const html = await waitForEmailHtml(email);
  const links = extractAllLinks(html).filter(link => link.includes("/auth/verify"))
  console.log('[DEBUG] Extracted verification links:', links);
  expect(links.length).toBe(1)

  await page.goto(links[0]);

  // Verify the magic link authenticated the user by checking the UI
  // (avoid visiting the profile loader which may hit missing test tables).
  await expect(page.locator('[aria-label="profile-menu"]')).toBeVisible({ timeout: 15000 });
});
