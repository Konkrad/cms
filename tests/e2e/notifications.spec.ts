/**
 * Notification system end to end: outbox -> worker (running in the dev server, polling every
 * NOTIFICATIONS_POLL_INTERVAL_MS) -> Mailpit / Telegram mock.
 */
import dotenv from "dotenv";
import {
	createJobInDb,
	createOutboxRowInDb,
	createPendingTicketPaymentInDb,
	createUserSession,
	expect,
	getNotificationPreference,
	getOutboxRowById,
	getOutboxRows,
	getUserEmailById,
	test,
} from "../fixtures";
import { extractAllLinks, waitForEmailHtml } from "../utils/mailpit-client";
import { signedCheckoutEvent } from "../utils/stripe-webhook";
import {
	getTelegramMessages,
	startTelegramMock,
	stopTelegramMock,
} from "../utils/telegram-mock";
import { createEventWithInventory } from "../utils/test-data";

// STRIPE_WEBHOOK_SECRET for signing the test webhook (the dev server reads the same .env).
dotenv.config();

async function loggedInPage(
	browser: import("@playwright/test").Browser,
	sessionToken: string,
) {
	const context = await browser.newContext({
		storageState: { cookies: [], origins: [] },
	});
	await context.addCookies([
		{
			name: "session",
			value: sessionToken,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Strict",
		},
	]);
	return { context, page: await context.newPage() };
}

async function approveJob(
	page: import("@playwright/test").Page,
	title: string,
) {
	await page.goto("/admin/root/jobs");
	const row = page.locator("tr", { hasText: title });
	await expect(row).toBeVisible({ timeout: 10_000 });
	await row.locator("button:has-text('Approve')").click();
	await expect(row.locator("text=Approved")).toBeVisible({ timeout: 10_000 });
}

test.describe("Notifications — optional notifications and preferences", () => {
	test("the unsubscribe link mutes jobs.approved; the next approval is not queued", async ({
		adminPage,
		browser,
		request,
	}) => {
		const poster = createUserSession("user", "notify-unsub");
		const posterEmail = getUserEmailById(poster.userId) as string;
		const titleA = `Unsub Job A ${Date.now()}`;
		const titleB = `Unsub Job B ${Date.now()}`;
		const first = createJobInDb({ suggestedBy: poster.userId, title: titleA });
		const second = createJobInDb({ suggestedBy: poster.userId, title: titleB });
		const guest = await browser.newContext({
			storageState: { cookies: [], origins: [] },
		});
		try {
			const since = new Date();
			await approveJob(adminPage, titleA);
			const html = await waitForEmailHtml(posterEmail, 30_000, since);
			const link = extractAllLinks(html)
				.map((l) => l.replaceAll("&amp;", "&"))
				.find((l) => l.includes("/api/notifications/unsubscribe?token="));
			expect(link).toBeTruthy();
			expect(
				getOutboxRows({
					notificationId: "jobs.approved",
					recipientUserId: poster.userId,
				}).map((r) => r.status),
			).toEqual(["sent"]);

			// The GET is a confirmation only (link scanners prefetch it).
			const page = await guest.newPage();
			await page.goto(link as string);
			expect(
				getNotificationPreference(poster.userId, "jobs.approved", "email"),
			).toBeNull();
			await page.locator("button:has-text('Unsubscribe')").click();
			await expect(page.locator("h1")).toHaveText("Unsubscribed");
			expect(
				getNotificationPreference(poster.userId, "jobs.approved", "email"),
			).toBe(false);

			// RFC 8058 one-click: a mail provider POSTs from its own servers, without our Origin.
			const oneClick = await request.post(link as string, {
				form: { "List-Unsubscribe": "One-Click" },
				headers: { Origin: "https://mail.example.net" },
			});
			expect(oneClick.status()).toBe(200);

			// A tampered token does nothing.
			const tampered = await request.post(
				(link as string).replace(/token=./, "token=X"),
				{ form: { "List-Unsubscribe": "One-Click" } },
			);
			expect(tampered.status()).toBe(400);

			await approveJob(adminPage, titleB);
			expect(
				getOutboxRows({
					notificationId: "jobs.approved",
					recipientUserId: poster.userId,
				}),
			).toHaveLength(1);
		} finally {
			await guest.close();
			first.cleanup();
			second.cleanup();
			poster.cleanup();
		}
	});

	test("profile toggles mute and unmute an optional notification", async ({
		browser,
	}) => {
		const session = createUserSession("user", "notify-toggle");
		const { context, page } = await loggedInPage(browser, session.sessionToken);
		try {
			await page.goto("/profile");
			const item = page.locator(
				'#notification-settings li[data-notification="jobs.approved"][data-channel="email"]',
			);
			await expect(item.locator("[data-state]")).toHaveText("On");

			await item.locator("button:has-text('Turn off')").click();
			await expect(item.locator("[data-state]")).toHaveText("Off");
			expect(
				getNotificationPreference(session.userId, "jobs.approved", "email"),
			).toBe(false);

			await item.locator("button:has-text('Turn on')").click();
			await expect(item.locator("[data-state]")).toHaveText("On");
			expect(
				getNotificationPreference(session.userId, "jobs.approved", "email"),
			).toBe(true);
		} finally {
			await context.close();
			session.cleanup();
		}
	});
});

test.describe("Notifications — admin failure view", () => {
	test("lists a failed row, and retry re-queues it for the worker", async ({
		adminPage: page,
	}) => {
		const recipient = createUserSession("user", "notify-admin");
		const row = createOutboxRowInDb({
			notificationId: "jobs.approved",
			channel: "email",
			recipientUserId: recipient.userId,
			recipientAddress: getUserEmailById(recipient.userId),
			data: { jobId: "e2e-job", jobTitle: "Retry Me" },
			status: "failed",
			attempts: 5,
			lastError: "550 mailbox unavailable (e2e)",
		});
		try {
			await page.goto("/admin/root/notifications");
			await expect(
				page.locator("nav a", { hasText: "Notifications" }),
			).toBeVisible();
			const tr = page.locator(`tr[data-outbox-id="${row.id}"]`);
			await expect(tr).toContainText("failed");
			await expect(tr).toContainText("550 mailbox unavailable (e2e)");
			await expect(tr).toContainText("jobs.approved");

			await tr.locator("button:has-text('Retry')").click();
			// Re-queued with a fresh attempt budget, then delivered by the worker.
			await expect
				.poll(() => getOutboxRowById(row.id)?.status, { timeout: 15_000 })
				.toBe("sent");
			expect(getOutboxRowById(row.id)?.attempts).toBe(1);
		} finally {
			row.cleanup();
			recipient.cleanup();
		}
	});

	test("is not reachable for members", async ({ memberPage: page }) => {
		const res = await page.goto("/admin/root/notifications");
		expect(res?.status()).toBe(403);
		await expect(page.locator("table")).toHaveCount(0);
	});
});

test.describe("Notifications — events", () => {
	let ownsTelegramMock = false;
	test.beforeAll(async () => {
		// tickets.spec.ts may hold port 8099 in another worker; then its mock receives the alert.
		ownsTelegramMock = await startTelegramMock().then(
			() => true,
			() => false,
		);
	});
	test.afterAll(async () => {
		if (ownsTelegramMock) await stopTelegramMock();
	});

	test("a free RSVP sends the ticket confirmation through the outbox", async ({
		browser,
		db,
	}) => {
		const session = createUserSession("user", "notify-rsvp");
		const email = getUserEmailById(session.userId) as string;
		const ev = await createEventWithInventory(
			{
				title: `Outbox RSVP Event ${Date.now()}`,
				startOffsetDays: 7,
				city: "Berlin",
				products: [{ name: "Free Pass", price: 0, maxQuantity: 10 }],
				salesStartOffset: -1,
				salesEndOffset: 10,
			},
			true,
		);
		const { context, page } = await loggedInPage(browser, session.sessionToken);
		try {
			await page.goto(`/events/${ev.slug}`);
			const since = new Date();
			await page.locator('button:has-text("✓ Going")').first().click();
			await expect(
				page.locator(
					"text=✓ You're attending! Your free ticket has been created.",
				),
			).toBeVisible({ timeout: 10_000 });

			const rows = getOutboxRows({
				notificationId: "events.ticket-confirmation",
				recipientUserId: session.userId,
			});
			expect(rows).toHaveLength(1);
			expect(rows[0].recipient_address).toBe(email);

			const html = await waitForEmailHtml(email, 30_000, since);
			expect(html).toContain("Purchase Confirmed");
			expect(html).toMatch(/\/profile\/tickets\/[0-9a-f-]+_[0-9a-f-]+/);
			expect(getOutboxRowById(rows[0].id)?.status).toBe("sent");
			expect(db.getTicketCountByEventIdAndUserId(ev.id, session.userId)).toBe(
				1,
			);
		} finally {
			await context.close();
			session.cleanup();
		}
	});

	test("a paid ticket (signed Stripe webhook) queues the Telegram sales alert", async ({
		request,
		db,
	}) => {
		const buyer = createUserSession("user", "notify-paid");
		const productName = `Outbox Paid Pass ${Date.now()}`;
		const ev = await createEventWithInventory(
			{
				title: `Outbox Paid Event ${Date.now()}`,
				startOffsetDays: 7,
				city: "Berlin",
				products: [{ name: productName, price: 15, maxQuantity: 10 }],
				salesStartOffset: -1,
				salesEndOffset: 10,
			},
			true,
		);
		const product = (
			db.getProductsByEventId(ev.id) as Array<{ id: string; name: string }>
		).find((p) => p.name === productName);
		// The pending order and payment the checkout creates (spec 4.7).
		const pending = createPendingTicketPaymentInDb({
			buyerId: buyer.userId,
			eventId: ev.id,
			productId: product?.id ?? "",
			unitPrice: 15,
		});
		try {
			const res = await request.post(
				"/api/payments/webhook/stripe",
				signedCheckoutEvent(pending.paymentId),
			);
			expect(res.status()).toBe(200);

			// The module's onPaid runs from the retried handler queue (scheduler tick).
			await expect
				.poll(
					() =>
						getOutboxRows({ notificationId: "events.sale" }).filter(
							(r) => JSON.parse(r.data).productName === productName,
						).length,
					{ timeout: 15_000 },
				)
				.toBe(1);
			const [alert] = getOutboxRows({ notificationId: "events.sale" }).filter(
				(r) => JSON.parse(r.data).productName === productName,
			);
			expect(alert).toMatchObject({
				channel: "telegram",
				recipient_user_id: null,
			});
			expect(JSON.parse(alert.data)).toMatchObject({
				productName,
				quantity: 1,
				amount: 15,
			});
			expect(
				getOutboxRows({
					notificationId: "events.ticket-confirmation",
					recipientUserId: buyer.userId,
				}),
			).toHaveLength(1);

			if (ownsTelegramMock) {
				await expect
					.poll(
						() =>
							getTelegramMessages().find((m) => m.text.includes(productName))
								?.text,
						{ timeout: 15_000 },
					)
					.toBe(
						`🎫 New sale: 1x ${productName} (€15.00)\n📊 Remaining: ${JSON.parse(alert.data).remaining} spots`,
					);
				await expect
					.poll(() => getOutboxRowById(alert.id)?.status, { timeout: 15_000 })
					.toBe("sent");
			}
		} finally {
			pending.cleanup();
			buyer.cleanup();
		}
	});
});
