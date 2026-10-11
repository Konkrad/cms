/**
 * Notification system end to end: outbox -> worker (running in the dev server, polling every
 * NOTIFICATIONS_POLL_INTERVAL_MS) -> Mailpit / Telegram mock.
 */
import {
	createJobInDb,
	createOutboxRowInDb,
	createUserSession,
	expect,
	getNotificationPreference,
	getOutboxRowById,
	getOutboxRows,
	getUserEmailById,
	test,
} from "../fixtures";
import { extractAllLinks, waitForEmailHtml } from "../utils/mailpit-client";

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
	await page.goto("/admin/global/jobs");
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
			await page.goto("/admin/global/notifications");
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
		await page.goto("/admin/global/notifications");
		await expect(page).not.toHaveURL(/\/admin\/global\/notifications/);
	});
});
