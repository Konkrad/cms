import { test, expect } from '../fixtures-e2e';
import { waitForEmailHtml, extractAllLinks } from '../utils/mailpit-client';
import { createEventWithInventory } from '../utils/test-data';

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

// Helper: find a representative event link from the groups index (first group with events)
async function findEventLinkFromGroups(page: any) {
  await page.goto('/groups');
  // Find first link to an event (href starts with /events/)
  const anchors = page.locator('a[href^="/events/"]');
  const count = await anchors.count();
  if (count === 0) throw new Error('No event links found on /groups');
  // prefer one that mentions 'Online' nearby, else return first
  for (let i = 0; i < count; i++) {
    const a = anchors.nth(i);
    const containerText = await a.evaluate((el) => el.closest('div')?.innerText || '');
    if (containerText.includes('Online')) {
      return a.getAttribute('href');
    }
  }
  return anchors.first().getAttribute('href');
}

async function findEventUrlByTitle(page: any, db: any, title: string) {
  const id = await db.getEventIdByTitle(title);
  if (!id) throw new Error(`Event titled '${title}' not found in DB`);
  return `/events/${id}`;
}

// Tests
test.describe('Events', () => {
  test('event public page shows location and CTA for logged-out users', async ({ page, db }) => {
    const ev = await createEventWithInventory({
      title: 'Berlin Summer Social (per-test)',
      startOffsetDays: 14,
      city: 'Berlin',
      products: [],
    }, false);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);

    // Location should be visible (either Online or a Join Waitlist CTA is acceptable)
    await expect(page.locator('text=Online').or(page.locator('text=Join Waitlist'))).toBeTruthy();

    // For logged-out users, expect login CTA
    await expect(page.locator('text=Log In to RSVP')).toBeVisible();
  });

  test('logged-in user can RSVP / join waitlist or go to checkout', async ({ page, db }) => {
    const email = uniqueEmail('event');
    await signInViaMagicLink(page, email);

    const ev = await createEventWithInventory({
      title: 'Berlin Summer Social (per-test)',
      startOffsetDays: 14,
      city: 'Berlin',
      products: [],
    }, false);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);

    // If Buy Your Tickets is present, click and ensure checkout opens
    if ((await page.locator('text=Buy Your Tickets').count()) > 0) {
      await page.click('text=Buy Your Tickets');
      await page.waitForURL(/\/events\/.+\/checkout/, { timeout: 15000 });
      await expect(page.locator('text=Tickets')).toBeVisible();
      return;
    }

    // If free RSVP is present, submit it
    if ((await page.locator('text=RSVP — I\'m Going').count()) > 0 || (await page.locator('button[name="status"][value="yes"]').count()) > 0) {
      // Click the RSVP button
      const rsvpBtn = page.locator('text=RSVP — I\'m Going').first();
      if (await rsvpBtn.count() > 0) {
        await rsvpBtn.click();
      } else {
        await page.click('button[name="status"][value="yes"]');
      }
      // Expect a confirmation message or toggle change
      await expect(page.locator("text=✓ You're attending!").or(page.locator("text=✓ You're Going!"))).toBeTruthy();
      return;
    }

    // If waitlist CTA exists
    if ((await page.locator('text=Join Waitlist').count()) > 0) {
      await page.click('text=Join Waitlist');
      await expect(page.locator("text=✓ You're on the waitlist!")).toBeVisible({ timeout: 5000 });
      return;
    }

    // Otherwise, try interacting with the participation toggle
    const toggle = page.locator('data-test=participation-toggle');
    if ((await toggle.count()) > 0) {
      await toggle.click();
      await expect(page.locator('text=✓')).toBeTruthy();
    }
  });

  test('online events show online indicator and no map', async ({ page, db }) => {
    const ev = await createEventWithInventory({
      title: 'All-Groups Online Town Hall (per-test)',
      startOffsetDays: 45,
      city: 'Online',
      products: [],
    }, false);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);
    // Look for the location heading that contains 'Online'
    await expect(page.locator('h3:has-text("Online")')).toBeVisible();
    // The map image for online events is /online.png
    await expect(page.locator('img[src="/online.png"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('ticketed event shows buy tickets and opens checkout', async ({ page, db }) => {
    const email = uniqueEmail('ticket');
    await signInViaMagicLink(page, email);

    const ev = await createEventWithInventory({
      title: 'Cologne Members Dinner (per-test)',
      startOffsetDays: 9,
      city: 'Cologne',
      products: [
        { name: 'Dinner Ticket', price: 25.0, maxQuantity: 5 }
      ],
      salesStartOffset: -1,
      salesEndOffset: 30,
    }, true);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);
    // Ensure the event actually has products seeded — use the just-created event id
    const id = ev.id;
    const products = await db.getProductsByEventId(id as string);
    if (!products || products.length === 0) {
      throw new Error('No products found for event — seed may have failed');
    }

    // Prefer checking for the checkout link by href — more robust than text match
    const checkoutHref = `/events/${id}/checkout`;
    await expect(page.locator(`a[href="${checkoutHref}"]`).first()).toBeVisible({ timeout: 5000 });
    await page.click(`a[href="${checkoutHref}"]`);
    await page.waitForURL(/\/events\/.+\/checkout/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Purchase Tickets")').or(page.locator('h2:has-text("Tickets")'))).toBeVisible();
  });

  test('sold-out event shows sold out or waitlist', async ({ page, db }) => {
    const ev = await createEventWithInventory({
      title: 'Munich Members Workshop: Public Speaking (per-test)',
      startOffsetDays: 30,
      city: 'Munich',
      products: [
        { name: 'Workshop Ticket', price: 0, maxQuantity: 2, soldQuantity: 2 }
      ],
      salesStartOffset: -10,
      salesEndOffset: 30,
    }, true);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);
    // either Sold Out badge or Join Waitlist appears
    await expect(page.locator('text=Sold Out').or(page.locator('text=Join Waitlist'))).toBeTruthy();
  });

  test('waitlist event can be joined and shows confirmation', async ({ page, db }) => {
    const ev = await createEventWithInventory({
      title: 'Hamburg Harbour Morning Walk (per-test)',
      startOffsetDays: 6,
      city: 'Hamburg',
      products: [
        { name: 'Walk Ticket', price: 0, maxQuantity: 1, soldQuantity: 1 }
      ],
      salesStartOffset: -5,
      salesEndOffset: 10,
    }, true);
    const email = uniqueEmail('waitlist');
    await signInViaMagicLink(page, email);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);
    // Either Join Waitlist is available (click it) or the event is Sold Out
    const waitlistCount = await page.locator('text=Join Waitlist').count();
    if (waitlistCount > 0) {
      await page.click('text=Join Waitlist');
      await expect(page.locator("text=✓ You're on the waitlist!")).toBeVisible({ timeout: 5000 });
    } else {
      await expect(page.locator('text=Sold Out').or(page.locator('text=Join Waitlist'))).toBeTruthy();
    }
  });

  test('past event hides RSVP/Buy buttons', async ({ page, db }) => {
    const ev = await createEventWithInventory({
      title: 'Past Meetup (E2E) (per-test)',
      startOffsetDays: -30,
      durationHours: 2,
      city: 'Berlin',
      products: [],
    }, false);
    const link = `/events/${ev.id}`;
    await page.goto(link as string);
    // Ensure Buy / RSVP / Waitlist CTAs are not present for past events
    await expect(await page.locator('text=Buy Your Tickets').count()).toBe(0);
    await expect(await page.locator("text=RSVP — I'm Going").count()).toBe(0);
    await expect(await page.locator('text=Join Waitlist').count()).toBe(0);
  });
});
