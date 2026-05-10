import { test, expect } from '../fixtures-e2e';
import { waitForEmailHtml, extractAllLinks } from '../utils/mailpit-client';
import { createEventWithInventory } from '../utils/test-data';
import Stripe from 'stripe';

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

test.describe('Tickets', () => {
  test('free ticket checkout creates tickets immediately', async ({ page, db }) => {
    const email = uniqueEmail('free-checkout');
    await signInViaMagicLink(page, email);

    // Create an event with multiple free products so the page shows the checkout flow
    const ev = await createEventWithInventory({
      title: 'Free Tickets Checkout Event (per-test)',
      startOffsetDays: 7,
      city: 'Berlin',
      products: [
        { name: 'Free Pass A', price: 0, maxQuantity: 10 },
        { name: 'Free Pass B', price: 0, maxQuantity: 10 },
      ],
      salesStartOffset: -1,
      salesEndOffset: 10,
    }, true);

    await page.goto(`/events/${ev.id}`);

    // Ensure checkout CTA exists and follow it
    const checkoutAnchors = await page.locator(`a[href="/events/${ev.id}/checkout"]`).count();
    if (checkoutAnchors === 0) throw new Error('Expected checkout CTA for multi-product free event');

    await page.click(`a[href="/events/${ev.id}/checkout"]`);
    await expect(page.locator('h1:has-text("Purchase Tickets")')).toBeVisible();

    // select first free product and proceed
    await page.click(`label:has-text("Free Pass A")`);
    await page.click('button:has-text("Proceed to Payment")');

    // Server will create free tickets immediately and client should show success
    await expect(page.locator('text=Payment Successful!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a:has-text("View My Tickets")')).toBeVisible();
  });

  test('free ticket RSVP creates attendance and ticket', async ({ page, db }) => {
    const email = uniqueEmail('free-rsvp');
    await signInViaMagicLink(page, email);

    // Create an event with a single free product so the page shows RSVP-style flow
    const ev = await createEventWithInventory({
      title: 'Free Tickets RSVP Event (per-test)',
      startOffsetDays: 7,
      city: 'Berlin',
      products: [{ name: 'Free Pass', price: 0, maxQuantity: 10 }],
      salesStartOffset: -1,
      salesEndOffset: 10,
    }, true);

    await page.goto(`/events/${ev.id}`);

    // Expect RSVP button and submit it
    const rsvpBtn = page.locator("text=RSVP — I'm Going").first();
    if ((await rsvpBtn.count()) === 0) throw new Error('Expected RSVP button for single-product free event');
    await rsvpBtn.click();

    // Inline confirmation should appear
    await expect(page.locator("text=✓ You're attending! Your free ticket has been created.")).toBeVisible({ timeout: 5000 });

    // Also verify that confirmation email was sent
    await waitForEmailHtml(email);
  });

  test('paid ticket purchase creates payment intent and processes webhook', async ({ page, db }) => {
    const email = uniqueEmail('paid');
    await signInViaMagicLink(page, email);

    const productName = 'VIP Ticket';
    const ev = await createEventWithInventory({
      title: 'Paid Tickets Event (per-test)',
      startOffsetDays: 10,
      city: 'Munich',
      products: [{ name: productName, price: 12.5, maxQuantity: 5 }],
      salesStartOffset: -1,
      salesEndOffset: 30,
    }, true);

    await page.goto(`/events/${ev.id}`);
    // Use the live stripe-mock + backend: click through normal checkout
    await page.click(`a[href="/events/${ev.id}/checkout"]`);
    await expect(page.locator('h1:has-text("Purchase Tickets")')).toBeVisible();

    // select product and proceed
    await page.click(`label:has-text("${productName}")`);

    // Click the Proceed button to move to payment step (client-side UI)
    await page.click('button:has-text("Proceed to Payment")');

    // proceed: client UI will create checkout session (we intercept it) and mount Stripe (stubbed)

    // Wait for the create-checkout-session action response (client posts to the action when moving to step 2)
    const createResp = await page.waitForResponse((r) => r.url().includes(`/events/${ev.id}/checkout`) && r.request().method() === 'POST', { timeout: 5000 });

    // Parse response to get paymentIntent id
    const createJson = await createResp.json();
    // Helper: recursively search for paymentIntentId in returned payload (Qwik action shapes can be nested)
    function findPaymentIntent(obj: any): string | null {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.paymentIntentId) return obj.paymentIntentId;
      for (const k of Object.keys(obj)) {
        try {
          const v = obj[k];
          const found = findPaymentIntent(v);
          if (found) return found;
        } catch (e) {
          continue;
        }
      }
      return null;
    }

    const paymentIntentId = findPaymentIntent(createJson);
    if (!paymentIntentId) {
      const status = createResp.status();
      throw new Error(`No paymentIntentId returned from server - status=${status} body=${JSON.stringify(createJson)}`);
    }

    // Verify order summary and that the Complete Payment button is enabled
    await expect(page.locator('h2:has-text("Order Summary")')).toBeVisible({ timeout: 5000 });
    await page.waitForSelector('button:has-text("Complete Payment"):not([disabled])', { timeout: 5000 });
    await expect(page.locator('button:has-text("Complete Payment")')).toBeVisible();

    // Click Complete Payment to submit payment. The client will poll the payment intent status.
    await page.click('button:has-text("Complete Payment")');

    // Confirm the payment intent in stripe-mock so it shows as succeeded when the server polls it
    const stripeHost = process.env.STRIPE_API_BASE_URL ? new URL(process.env.STRIPE_API_BASE_URL) : new URL('http://localhost:12111');
    // Use the stripe-mock test helper to confirm the payment intent
    await fetch(`${stripeHost.origin}/v1/test_helpers/payment_intents/${paymentIntentId}/confirm`, { method: 'POST' });

    // Build a webhook event for payment_intent.succeeded and POST it to the app to run fulfillment
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2026-02-25.clover', host: stripeHost.hostname, port: stripeHost.port ? Number(stripeHost.port) : 12111, protocol: (stripeHost.protocol.replace(':','') as any) });
    // Retrieve the payment intent object from stripe-mock
    const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId);

    const eventPayload = {
      id: `evt_test_${Date.now()}`,
      type: 'payment_intent.succeeded',
      data: { object: pi },
    };

    const payloadString = JSON.stringify(eventPayload);
    const sig = stripeClient.webhooks.generateTestHeaderString({ payload: payloadString, secret: process.env.STRIPE_WEBHOOK_SECRET || '' });

    // Post webhook to the app
    const webhookUrl = new URL('/api/webhooks/stripe', page.url()).toString();
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': sig,
      },
      body: payloadString,
    });

    // Wait for the app to process webhook and send confirmation email
    await waitForEmailHtml(email);
  });
});

export {};
