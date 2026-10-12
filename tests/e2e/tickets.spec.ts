import {
	createTestUser,
	expect,
	getPaymentById,
	getPaymentsBySubject,
	getTransactionStatus,
	getUserIdByEmail,
	REQUIREMENT_VERSIONS,
	SHARED_E2E_EMAIL,
	test,
} from "../fixtures";
import { waitForEmailHtml } from "../utils/mailpit-client";
import { signedCheckoutEvent } from "../utils/stripe-webhook";
import {
	clearTelegramMessages,
	getTelegramMessages,
	startTelegramMock,
	stopTelegramMock,
} from "../utils/telegram-mock";
import { createEventWithInventory } from "../utils/test-data";

test.describe("Tickets", () => {
	test.beforeAll(async () => {
		await startTelegramMock();
	});

	test.afterAll(async () => {
		await stopTelegramMock();
	});
	test("free ticket checkout creates tickets immediately", async ({
		page,
		db,
	}) => {
		// Create an event with multiple free products so the page shows the checkout flow
		const ev = await createEventWithInventory(
			{
				title: "Free Tickets Checkout Event (per-test)",
				startOffsetDays: 7,
				city: "Berlin",
				products: [
					{ name: "Free Pass A", price: 0, maxQuantity: 10 },
					{ name: "Free Pass B", price: 0, maxQuantity: 10 },
				],
				salesStartOffset: -1,
				salesEndOffset: 10,
			},
			true,
		);

		await page.goto(`/events/${ev.slug}`);

		// Ensure checkout CTA exists and follow it
		const checkoutAnchors = await page
			.locator(`a[href="/events/${ev.slug}/checkout"]`)
			.count();
		if (checkoutAnchors === 0)
			throw new Error("Expected checkout CTA for multi-product free event");

		await page.click(`a[href="/events/${ev.slug}/checkout"]`);
		await expect(page.locator('h1:has-text("Purchase Tickets")')).toBeVisible();

		// select first free product and proceed
		await page
			.locator(`div:has-text("Free Pass A") input[type="radio"]`)
			.first()
			.check();
		await page.click('button:has-text("Continue to Participants")');
		await page.click('button:has-text("Continue to Payment")');

		// Server will create free tickets immediately and client should show success
		await expect(page.locator("text=Payment Successful!")).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator('a:has-text("View My Tickets")')).toBeVisible();
	});

	test("free ticket RSVP creates attendance and ticket", async ({
		page,
		db,
	}) => {
		// Create an event with a single free product so the page shows RSVP-style flow
		const ev = await createEventWithInventory(
			{
				title: "Free Tickets RSVP Event (per-test)",
				startOffsetDays: 7,
				city: "Berlin",
				products: [{ name: "Free Pass", price: 0, maxQuantity: 10 }],
				salesStartOffset: -1,
				salesEndOffset: 10,
			},
			true,
		);

		await page.goto(`/events/${ev.slug}`);

		// Expect participation toggle and select yes.
		const rsvpBtn = page.locator('button:has-text("✓ Going")').first();
		if ((await rsvpBtn.count()) === 0)
			throw new Error(
				"Expected participation toggle for single-product free event",
			);
		const since = new Date();
		await rsvpBtn.click();

		// Inline confirmation should appear
		await expect(
			page.locator(
				"text=✓ You're attending! Your free ticket has been created.",
			),
		).toBeVisible({ timeout: 5000 });

		// Also verify that confirmation email was sent
		await waitForEmailHtml(SHARED_E2E_EMAIL, 30000, since);
	});

	test("free ticket RSVP does not create duplicate tickets on repeated clicks", async ({
		memberPage: page,
		db,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Free Tickets RSVP Idempotent Event (per-test)",
				startOffsetDays: 7,
				city: "Berlin",
				products: [{ name: "Free Pass", price: 0, maxQuantity: 10 }],
				salesStartOffset: -1,
				salesEndOffset: 10,
			},
			true,
		);

		await page.goto(`/events/${ev.slug}`);

		const rsvpBtn = page.locator('button:has-text("✓ Going")').first();
		await expect(rsvpBtn).toBeVisible({ timeout: 5_000 });

		// First click — wait for success confirmation
		await rsvpBtn.click();
		await expect(
			page.locator(
				"text=✓ You're attending! Your free ticket has been created.",
			),
		).toBeVisible({ timeout: 10_000 });

		// Second click to test idempotency — button may still be present in its Going state
		await rsvpBtn.click().catch(() => {});

		await expect
			.poll(() => db.getTicketCountByEventId(ev.id), { timeout: 5_000 })
			.toBe(1);
	});

	test("free single-product RSVP maybe/no manages ticket and sold quantity", async ({
		memberPage: page,
		db,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Free RSVP Maybe No Lifecycle Event (per-test)",
				startOffsetDays: 7,
				city: "Berlin",
				products: [{ name: "Free Pass", price: 0, maxQuantity: 10 }],
				salesStartOffset: -1,
				salesEndOffset: 10,
			},
			true,
		);

		const product = db.getProductsByEventId(ev.id)[0] as {
			id: string;
			sold_quantity: number;
		};

		await page.goto(`/events/${ev.slug}`);

		await expect(page.locator('button:has-text("✓ Going")')).toBeVisible({
			timeout: 5_000,
		});
		await page.click('button:has-text("✓ Going")');

		await expect(page.locator('button:has-text("? Maybe")')).toBeVisible({
			timeout: 5_000,
		});
		await page.click('button:has-text("? Maybe")');

		await expect
			.poll(() => db.getTicketCountByEventId(ev.id), { timeout: 5_000 })
			.toBe(1);
		await expect
			.poll(() => db.getProductSoldQuantityById(product.id), { timeout: 5_000 })
			.toBe(product.sold_quantity + 1);

		await expect(page.locator('button:has-text("✗ Not Going")')).toBeVisible({
			timeout: 5_000,
		});
		await page.click('button:has-text("✗ Not Going")');

		await expect
			.poll(() => db.getTicketCountByEventId(ev.id), { timeout: 5_000 })
			.toBe(0);
		await expect
			.poll(() => db.getProductSoldQuantityById(product.id), { timeout: 5_000 })
			.toBe(product.sold_quantity);
	});

	test("paid ticket purchase: payment row, signed webhook, ticket and receipt", async ({
		page,
		db,
	}) => {
		const productName = "VIP Ticket";
		const ev = await createEventWithInventory(
			{
				title: "Paid Tickets Event (per-test)",
				startOffsetDays: 10,
				city: "Munich",
				products: [{ name: productName, price: 12.5, maxQuantity: 5 }],
				salesStartOffset: -1,
				salesEndOffset: 30,
			},
			true,
		);
		const sharedUserId = getUserIdByEmail(SHARED_E2E_EMAIL);

		// The provider's hosted checkout page (stripe-mock answers with a checkout.stripe.com URL).
		await page.route("https://checkout.stripe.com/**", (route) =>
			route.fulfill({
				contentType: "text/html",
				body: "<html><body><h1>Stripe Checkout (test)</h1></body></html>",
			}),
		);

		await page.goto(`/events/${ev.slug}`);
		await page.click(`a[href="/events/${ev.slug}/checkout"]`);
		await expect(page.locator('h1:has-text("Purchase Tickets")')).toBeVisible();
		await page
			.locator(`div:has-text("${productName}") input[type="radio"]`)
			.first()
			.check();
		await page.click('button:has-text("Continue to Participants")');
		await page.click('button:has-text("Continue to Payment")');
		await expect(page.locator('h2:has-text("Order Summary")')).toBeVisible();

		// Complete Payment creates the payment and sends the buyer to the provider.
		await page.click('button:has-text("Complete Payment")');
		await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

		const [payment] = getPaymentsBySubject(`events:event:${ev.id}`);
		expect(payment).toMatchObject({
			module_id: "events",
			kind: "tickets",
			user_id: sharedUserId,
			status: "pending",
			// From the product's DB price, in cents.
			amount: 1250,
			currency: "eur",
		});
		expect(payment.provider_ref).toBeTruthy();
		expect(getTransactionStatus(payment.id)).toBe("pending");

		// Back on the site before the webhook: not shown as paid (the return proves nothing).
		await page.goto(`/events/${ev.slug}/checkout?payment=${payment.id}`);
		await expect(page.getByText("Payment processing")).toBeVisible();

		// Stripe's signed webhook marks it paid; the module issues the ticket.
		const since = new Date();
		clearTelegramMessages();
		const res = await page.request.post(
			"/api/payments/webhook/stripe",
			signedCheckoutEvent(payment.id),
		);
		expect(res.status()).toBe(200);
		expect(getPaymentById(payment.id)?.status).toBe("paid");
		await expect
			.poll(() => getTransactionStatus(payment.id), { timeout: 15_000 })
			.toBe("paid");
		await expect
			.poll(() =>
				db.getTicketCountByEventIdAndUserId(ev.id, sharedUserId ?? ""),
			)
			.toBe(1);

		// The events ticket email and core's generic receipt both arrive.
		const ticketMail = await waitForEmailHtml(
			SHARED_E2E_EMAIL,
			30_000,
			since,
			"Your tickets",
		);
		expect(ticketMail).toContain("Purchase Confirmed");
		const receipt = await waitForEmailHtml(
			SHARED_E2E_EMAIL,
			30_000,
			since,
			"Your receipt",
		);
		expect(receipt).toContain(productName);
		expect(receipt).toContain("€12.50");

		await page.goto(`/events/${ev.slug}/checkout?payment=${payment.id}`);
		await expect(page.getByText("Payment Successful!")).toBeVisible();

		// Telegram notifications are best-effort and can be disabled in some test setups.
		const telegramMsgs = getTelegramMessages();
		if (telegramMsgs.length > 0) {
			expect(telegramMsgs[0].text).toContain(productName);
		}
	});
});

test.describe("Participant Assignment Step", () => {
	/**
	 * Helper: navigate to the participant assignment step for an event.
	 * Returns the page already at step 2.
	 */
	async function reachParticipantStep(
		page: import("@playwright/test").Page,
		eventId: string,
		productName: string,
	) {
		await page.goto(`/events/${eventId}/checkout`);
		await expect(page.locator('h1:has-text("Purchase Tickets")')).toBeVisible();
		// Select the product (radio or +/- control)
		const radio = page
			.locator(`div:has-text("${productName}") input[type="radio"]`)
			.first();
		if ((await radio.count()) > 0) {
			await radio.check();
		}
		await page.click('button:has-text("Continue to Participants")');
		await expect(
			page.locator('h2:has-text("Participant Assignment")'),
		).toBeVisible();
	}

	test("buyer is pre-assigned to the first slot of each product", async ({
		browser,
	}) => {
		const session = createTestUser({
			completed: Object.keys(REQUIREMENT_VERSIONS),
		});

		const ev = await createEventWithInventory({
			title: "Participant Pre-assign Test",
			startOffsetDays: 7,
			city: "Berlin",
			products: [
				{
					name: "Product A",
					price: 0,
					maxQuantity: 10,
					participantCapacity: 1,
				},
				{
					name: "Product B",
					price: 0,
					maxQuantity: 10,
					participantCapacity: 1,
				},
			],
			salesStartOffset: -1,
			salesEndOffset: 10,
			separateGroups: true,
		});

		const ctx = await browser.newContext();
		await ctx.addCookies([
			{
				name: "session",
				value: session.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		const page = await ctx.newPage();

		try {
			await page.goto(`/events/${ev.slug}/checkout`);
			await expect(
				page.locator('h1:has-text("Purchase Tickets")'),
			).toBeVisible();

			// Select 1 of Product A and 1 of Product B (each in its own group — radio per group)
			const radios = page.locator('input[type="radio"]');
			await expect(radios.first()).toBeVisible({ timeout: 10000 });
			await radios.nth(0).check();
			await radios.nth(1).check();

			await page.click('button:has-text("Continue to Participants")');
			await expect(
				page.locator('h2:has-text("Participant Assignment")'),
			).toBeVisible({ timeout: 15000 });

			// Buyer "Test User" should appear once per product card (in the locked participant slot)
			const buyerRows = page.locator("p.text-sm.font-medium.truncate", {
				hasText: "Test User",
			});
			await expect(buyerRows).toHaveCount(2, { timeout: 15000 });
		} finally {
			await ctx.close();
			session.cleanup();
		}
	});

	test("can proceed to payment with unfilled capacity slots", async ({
		browser,
	}) => {
		const session = createTestUser({
			completed: Object.keys(REQUIREMENT_VERSIONS),
		});

		const ev = await createEventWithInventory({
			title: "Empty Slot Proceed Test",
			startOffsetDays: 7,
			city: "Berlin",
			products: [
				{
					name: "Pair Pass",
					price: 0,
					maxQuantity: 10,
					participantCapacity: 2,
				},
			],
			salesStartOffset: -1,
			salesEndOffset: 10,
		});

		const ctx = await browser.newContext();
		await ctx.addCookies([
			{
				name: "session",
				value: session.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		const page = await ctx.newPage();

		try {
			await page.goto(`/events/${ev.slug}/checkout`);
			await expect(
				page.locator('h1:has-text("Purchase Tickets")'),
			).toBeVisible();

			const radio = page.locator('input[type="radio"]').first();
			if ((await radio.count()) > 0) await radio.check();

			await page.click('button:has-text("Continue to Participants")');
			await expect(
				page.locator('h2:has-text("Participant Assignment")'),
			).toBeVisible();

			// Slot counter should show 1/2 (buyer assigned, second empty)
			await expect(page.locator("text=1/2 assigned")).toBeVisible();

			// Continue to payment — empty second slot must not block
			await page.click('button:has-text("Continue to Payment")');
			await expect(
				page
					.locator('h2:has-text("Payment Details")')
					.or(page.getByText("Payment Successful!")),
			).toBeVisible({ timeout: 10000 });
		} finally {
			await ctx.close();
			session.cleanup();
		}
	});

	test("manual participant entry fills an open slot", async ({ browser }) => {
		const session = createTestUser({
			completed: Object.keys(REQUIREMENT_VERSIONS),
		});

		const ev = await createEventWithInventory({
			title: "Manual Entry Test",
			startOffsetDays: 7,
			city: "Berlin",
			products: [
				{ name: "Duo Pass", price: 0, maxQuantity: 10, participantCapacity: 2 },
			],
			salesStartOffset: -1,
			salesEndOffset: 10,
		});

		const ctx = await browser.newContext();
		await ctx.addCookies([
			{
				name: "session",
				value: session.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		const page = await ctx.newPage();

		try {
			await page.goto(`/events/${ev.slug}/checkout`);
			await expect(
				page.locator('h1:has-text("Purchase Tickets")'),
			).toBeVisible();

			const radio = page.locator('input[type="radio"]').first();
			if ((await radio.count()) > 0) await radio.check();

			await page.click('button:has-text("Continue to Participants")');
			await expect(
				page.locator('h2:has-text("Participant Assignment")'),
			).toBeVisible();

			// Open the dropdown and click "Add manually"
			await page
				.locator('input[placeholder="Search participant by name…"]')
				.click();
			await page.click("text=Add manually");

			// Fill in the manual form
			await page.locator('input[placeholder="Full name"]').fill("Jane Doe");
			await page
				.locator('input[placeholder="Email address"]')
				.fill("jane@example.com");
			await page.click('button:has-text("Add")');

			// Jane should now appear in the slot list
			await expect(page.locator("text=Jane Doe")).toBeVisible();

			// Counter should now show 2/2
			await expect(page.locator("text=2/2 assigned")).toBeVisible();
		} finally {
			await ctx.close();
			session.cleanup();
		}
	});
});
