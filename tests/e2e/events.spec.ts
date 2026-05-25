import { test, expect } from '../fixtures';
import { createEventWithInventory } from '../utils/test-data';

// =============================================================================
// Guest (logged-out) visibility
// =============================================================================

test.describe('Events — guest visibility', () => {
  test('public page shows "Log In to RSVP" for logged-out users', async ({ guestPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Berlin Summer Social (per-test)',
      startOffsetDays: 14,
      city: 'Berlin',
      products: [],
    }, false);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator('text=Log In to RSVP')).toBeVisible();
  });

  test('online event shows online indicator and /online.png map image', async ({ guestPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'All-Groups Online Town Hall (per-test)',
      startOffsetDays: 45,
      city: 'Online',
      products: [],
    }, false);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator('h3:has-text("Online")')).toBeVisible();
    await expect(page.locator('img[src="/online.png"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('ticketed event shows a checkout link', async ({ memberPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Cologne Members Dinner (per-test)',
      startOffsetDays: 9,
      city: 'Cologne',
      products: [{ name: 'Dinner Ticket', price: 25.0, maxQuantity: 5 }],
      salesStartOffset: -1,
      salesEndOffset: 30,
    }, true);
    await page.goto(`/events/${ev.id}`);
    await expect(
      page.locator(`a[href="/events/${ev.id}/checkout"]`).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('sold-out event shows Sold Out badge', async ({ memberPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Munich Members Workshop: Public Speaking (per-test)',
      startOffsetDays: 30,
      city: 'Munich',
      products: [{ name: 'Workshop Ticket', price: 0, maxQuantity: 2, soldQuantity: 2 }],
      salesStartOffset: -10,
      salesEndOffset: 30,
    }, true);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator('text=Sold Out')).toBeVisible({ timeout: 5_000 });
  });

  test('past event hides RSVP, Buy, and Waitlist CTAs', async ({ guestPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Past Meetup (E2E) (per-test)',
      startOffsetDays: -30,
      durationHours: 2,
      city: 'Berlin',
      products: [],
    }, false);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator('text=Buy Your Tickets')).toHaveCount(0);
    await expect(page.locator("text=RSVP — I'm Going")).toHaveCount(0);
    await expect(page.locator('text=Join Waitlist')).toHaveCount(0);
  });
});

// =============================================================================
// Logged-in user interactions
// =============================================================================

test.describe('Events — logged-in interactions', () => {
  test('logged-in user can RSVP for a free event', async ({ memberPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Berlin Summer Social (per-test)',
      startOffsetDays: 14,
      city: 'Berlin',
      products: [{ name: 'Free Entry', price: 0, maxQuantity: 100 }],
      salesStartOffset: -1,
      salesEndOffset: 30,
      needsTicket: false,
    }, true);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator("text=RSVP — I'm Going")).toBeVisible({ timeout: 5_000 });
    await page.click("text=RSVP — I'm Going");
    await expect(
      page.locator("text=✓ You're attending!").or(page.locator("text=✓ You're Going!")),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('logged-in user can navigate to checkout for a ticketed event', async ({ memberPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Cologne Members Dinner (per-test)',
      startOffsetDays: 9,
      city: 'Cologne',
      products: [{ name: 'Dinner Ticket', price: 25.0, maxQuantity: 5 }],
      salesStartOffset: -1,
      salesEndOffset: 30,
    }, true);
    await page.goto(`/events/${ev.id}`);
    await page.click(`a[href="/events/${ev.id}/checkout"]`);
    await page.waitForURL(/\/events\/.+\/checkout/, { timeout: 15_000 });
    await expect(
      page.locator('h1:has-text("Purchase Tickets")').or(page.locator('h2:has-text("Tickets")')),
    ).toBeVisible();
  });

  test('logged-in user can join the waitlist for an event without ticket sales', async ({ memberPage: page }) => {
    const ev = await createEventWithInventory({
      title: 'Hamburg Harbour Morning Walk (per-test)',
      startOffsetDays: 6,
      city: 'Hamburg',
      products: [],
    }, false);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator('text=Join Waitlist')).toBeVisible({ timeout: 5_000 });
    await page.click('text=Join Waitlist');
    await expect(page.locator("text=✓ You're on the waitlist!")).toBeVisible({ timeout: 5_000 });
  });
});
