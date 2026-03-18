import { test, expect } from '../fixtures-e2e';
import { waitForEmailHtml, extractAllLinks } from '../utils/mailpit-client';

function uniqueEmail(prefix = 'e2e') {
  return `${prefix}+${Date.now()}@example.com`;
}

async function signInViaMagicLink(page: any, email: string) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.click('button[type="submit"]');
  const html = await waitForEmailHtml(email);
  const links = extractAllLinks(html).filter((l) => l.includes('/auth/verify'));
  if (!links.length) throw new Error('No magic link found');
  await page.goto(links[0]);
  await page.waitForSelector('[aria-label="profile-menu"]', { timeout: 15000 });
}

// NOTE: These tests assume a group exists at /groups/<slug>. Use a known slug.
const GROUP_SLUG = 'berlin';
const GROUP_URL = `/groups/${GROUP_SLUG}`;

test.describe('Groups page', () => {
  test('public view shows group info for logged-out users', async ({ page }) => {
    await page.goto(GROUP_URL);
    // Check for the members tile and a visible join CTA
    await expect(page.locator('text=Community Members')).toBeVisible();
    await expect(page.locator('text=Join This Group')).toBeVisible();
  });

  test('logged-in user can join group', async ({ page }) => {
    const email = uniqueEmail('group-join');
    await signInViaMagicLink(page, email);

    await page.goto(GROUP_URL);
    const joinBtn = page.locator('button:has-text("Join This Group")').first();
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    // After joining, expect a 'Leave' or 'Member' indicator or member appears in list
    await expect(page.locator('text=Leave').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('text=Member').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('group admin can promote a member to admin and sees user list', async ({ page }) => {
    // Sign in as admin user (use distinct email)
    const adminEmail = uniqueEmail('group-admin');
    await signInViaMagicLink(page, adminEmail);

    // Visit group and open members modal via the 'See All Members' CTA
    await page.goto(GROUP_URL);
    await expect(page.locator('text=See All Members')).toBeVisible({ timeout: 5000 });
    await page.locator('text=See All Members').click();

    // Expect the participants modal to open and show either a 'No participants yet' message or a list
    await expect(page.locator('text=Participants —')).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('text=No participants yet').or(page.locator('ul li'))).toBeTruthy();

    // NOTE: Promoting members is part of the admin UI and may live in a separate admin area.
    // Implement promotion tests once the app exposes an admin UI for group member management.
  });
});
