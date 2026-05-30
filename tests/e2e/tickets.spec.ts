import { test, expect, SHARED_E2E_EMAIL, getUserIdByEmail } from '../fixtures';
import { waitForEmailHtml } from '../utils/mailpit-client';
import { startTelegramMock, stopTelegramMock, getTelegramMessages, clearTelegramMessages } from '../utils/telegram-mock';
import { createEventWithInventory } from '../utils/test-data';
import Stripe from 'stripe';

test.describe('Tickets', () => {
  test.beforeAll(async () => {
    await startTelegramMock();
  });

  test.afterAll(async () => {
    await stopTelegramMock();
  });
  test('free ticket checkout creates tickets immediately', async ({ page, db }) => {
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
    await page.locator(`div:has-text("Free Pass A") input[type="radio"]`).first().check();
    await page.click('button:has-text("Continue to Participants")');
    await page.click('button:has-text("Continue to Payment")');

    // Server will create free tickets immediately and client should show success
    await expect(page.locator('text=Payment Successful!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a:has-text("View My Tickets")')).toBeVisible();
  });

  test('free ticket RSVP creates attendance and ticket', async ({ page, db }) => {
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

    // Expect participation toggle and select yes.
    const rsvpBtn = page.locator('button:has-text("✓ Going")').first();
    if ((await rsvpBtn.count()) === 0) throw new Error('Expected participation toggle for single-product free event');
    const since = new Date();
    await rsvpBtn.click();

    // Inline confirmation should appear
    await expect(page.locator("text=✓ You're attending! Your free ticket has been created.")).toBeVisible({ timeout: 5000 });

    // Also verify that confirmation email was sent
    await waitForEmailHtml(SHARED_E2E_EMAIL, 30000, since);
  });

  test('free ticket RSVP does not create duplicate tickets on repeated clicks', async ({ memberPage: page, db }) => {
    const ev = await createEventWithInventory({
      title: 'Free Tickets RSVP Idempotent Event (per-test)',
      startOffsetDays: 7,
      city: 'Berlin',
      products: [{ name: 'Free Pass', price: 0, maxQuantity: 10 }],
      salesStartOffset: -1,
      salesEndOffset: 10,
    }, true);

    await page.goto(`/events/${ev.id}`);

    const rsvpBtn = page.locator('button:has-text("✓ Going")').first();
    await expect(rsvpBtn).toBeVisible({ timeout: 5_000 });

    await rsvpBtn.click({ clickCount: 2, delay: 50 });

    await expect(page.locator("text=✓ You're attending! Your free ticket has been created.")).toBeVisible({ timeout: 5_000 });

    await expect.poll(
      () => db.getTicketCountByEventId(ev.id),
      { timeout: 5_000 },
    ).toBe(1);
  });

  test('free single-product RSVP maybe/no manages ticket and sold quantity', async ({ memberPage: page, db }) => {
    const ev = await createEventWithInventory({
      title: 'Free RSVP Maybe No Lifecycle Event (per-test)',
      startOffsetDays: 7,
      city: 'Berlin',
      products: [{ name: 'Free Pass', price: 0, maxQuantity: 10 }],
      salesStartOffset: -1,
      salesEndOffset: 10,
    }, true);

    const product = db.getProductsByEventId(ev.id)[0] as { id: string; sold_quantity: number };

    await page.goto(`/events/${ev.id}`);

    await expect(page.locator('button:has-text("✓ Going")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("✓ Going")');

    await expect(page.locator('button:has-text("? Maybe")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("? Maybe")');

    await expect.poll(
      () => db.getTicketCountByEventId(ev.id),
      { timeout: 5_000 },
    ).toBe(1);
    await expect.poll(
      () => db.getProductSoldQuantityById(product.id),
      { timeout: 5_000 },
    ).toBe(product.sold_quantity + 1);

    await expect(page.locator('button:has-text("✗ Not Going")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("✗ Not Going")');

    await expect.poll(
      () => db.getTicketCountByEventId(ev.id),
      { timeout: 5_000 },
    ).toBe(0);
    await expect.poll(
      () => db.getProductSoldQuantityById(product.id),
      { timeout: 5_000 },
    ).toBe(product.sold_quantity);
  });

  test('paid ticket purchase creates payment intent and processes webhook', async ({ page, db }) => {
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
    await page.locator(`div:has-text("${productName}") input[type="radio"]`).first().check();

    // Move through participants and into payment.
    await page.click('button:has-text("Continue to Participants")');
    await page.click('button:has-text("Continue to Payment")');

    // proceed: client UI will create checkout session (we intercept it) and mount Stripe (stubbed)

    // Wait for the create-checkout-session action response (client posts to the action when moving to step 2)
    const createResp = await page.waitForResponse((r) => r.url().includes(`/events/${ev.id}/checkout`) && r.request().method() === 'POST', { timeout: 5000 });

    // Parse response to get paymentIntent id
    const createJson = await createResp.json();
    // Helper: recursively search for paymentIntentId in returned payload (Qwik action shapes can be nested)
    function findPaymentIntent(obj: any): string | null {
      if (!obj || typeof obj !== 'object') return null;
      if (obj.paymentIntentId) return obj.paymentIntentId;
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = obj[k];
        // Handle Qwik SSR serialization: "paymentIntentId" appears as a string
        // value in an array followed 2 positions later by the actual ID (due to type tags)
        if (v === 'paymentIntentId' && i + 2 < keys.length) {
          const maybeId = obj[keys[i + 2]];
          if (typeof maybeId === 'string' && maybeId.startsWith('pi_')) {
            return maybeId;
          }
        }
        try {
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
    const since = new Date();
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2026-04-22.dahlia', host: stripeHost.hostname, port: stripeHost.port ? Number(stripeHost.port) : 12111, protocol: (stripeHost.protocol.replace(':','') as any) });
    // Retrieve the payment intent object from stripe-mock.
    // stripe-mock is stateless: it ignores metadata on create and returns a canned
    // amount/metadata on retrieve. Inject the real values from the test context so
    // the webhook handler can look up the event/user and calculate fees correctly.
    const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId);
    const sharedUserId = getUserIdByEmail(SHARED_E2E_EMAIL);
    const eventProducts = db.getProductsByEventId(ev.id) as Array<{ id: string; name: string; price: number }>;
    const chosenProduct = eventProducts.find(p => p.name === productName) ?? eventProducts[0];
    const totalAmountCents = Math.round(chosenProduct.price * 100);
    (pi as any).amount = totalAmountCents;
    (pi as any).metadata = {
      eventId: ev.id,
      userId: sharedUserId,
      items: JSON.stringify([{ productId: chosenProduct.id, quantity: 1 }]),
    };

    const eventPayload = {
      id: `evt_test_${Date.now()}`,
      type: 'payment_intent.succeeded',
      data: { object: pi },
    };

    const payloadString = JSON.stringify(eventPayload);
    const sig = stripeClient.webhooks.generateTestHeaderString({ payload: payloadString, secret: process.env.STRIPE_WEBHOOK_SECRET || '' });

    // Post webhook to the app
    clearTelegramMessages();
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
    await waitForEmailHtml(SHARED_E2E_EMAIL, 30000, since);

    // Telegram notifications are best-effort and can be disabled in some test setups.
    const telegramMsgs = getTelegramMessages();
    if (telegramMsgs.length > 0) {
      expect(telegramMsgs[0].text).toContain(productName);
    }
  });
});

export {};
