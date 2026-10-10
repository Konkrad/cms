import {
	addGroupMember,
	addGroupRepresentative,
	createGroupEventInDb,
	createGroupInDb,
	createUserSession,
	deleteGroupInDb,
	deleteGroupMember,
	deleteGroupRepresentative,
	expect,
	getUserEmailById,
	setParticipationInDb,
	test,
} from "../fixtures";
import { createEventWithInventory } from "../utils/test-data";

// =============================================================================
// Guest (logged-out) visibility
// =============================================================================

test.describe("Events — guest visibility", () => {
	test('public page shows "Log In to RSVP" for logged-out users', async ({
		guestPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Berlin Summer Social (per-test)",
				startOffsetDays: 14,
				city: "Berlin",
				products: [],
			},
			false,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(page.locator("text=Log In to RSVP")).toBeVisible();
	});

	test("online event shows online indicator and /online.png map image", async ({
		guestPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "All-Groups Online Town Hall (per-test)",
				startOffsetDays: 45,
				city: "Online",
				products: [],
			},
			false,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(page.locator('h3:has-text("Online")')).toBeVisible();
		await expect(page.locator('img[src="/online.png"]').first()).toBeVisible({
			timeout: 5_000,
		});
	});

	test("ticketed event shows a checkout link", async ({ memberPage: page }) => {
		const ev = await createEventWithInventory(
			{
				title: "Cologne Members Dinner (per-test)",
				startOffsetDays: 9,
				city: "Cologne",
				products: [{ name: "Dinner Ticket", price: 25.0, maxQuantity: 5 }],
				salesStartOffset: -1,
				salesEndOffset: 30,
			},
			true,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(
			page.locator(`a[href="/events/${ev.id}/checkout"]`).first(),
		).toBeVisible({ timeout: 5_000 });
	});

	test("sold-out event shows Sold Out badge", async ({ memberPage: page }) => {
		const ev = await createEventWithInventory(
			{
				title: "Munich Members Workshop: Public Speaking (per-test)",
				startOffsetDays: 30,
				city: "Munich",
				products: [
					{
						name: "Workshop Ticket",
						price: 0,
						maxQuantity: 2,
						soldQuantity: 2,
					},
				],
				salesStartOffset: -10,
				salesEndOffset: 30,
			},
			true,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(page.locator("text=Sold Out")).toBeVisible({ timeout: 5_000 });
	});

	test("past event hides RSVP, Buy, and Waitlist CTAs", async ({
		guestPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Past Meetup (E2E) (per-test)",
				startOffsetDays: -30,
				durationHours: 2,
				city: "Berlin",
				products: [],
			},
			false,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(page.locator("text=Buy Your Tickets")).toHaveCount(0);
		await expect(page.locator('button:has-text("✓ Going")')).toHaveCount(0);
		await expect(page.locator("text=Join Waitlist")).toHaveCount(0);
	});
});

// =============================================================================
// Logged-in user interactions
// =============================================================================

test.describe("Events — logged-in interactions", () => {
	test("logged-in user can RSVP for a free event", async ({
		memberPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Berlin Summer Social (per-test)",
				startOffsetDays: 14,
				city: "Berlin",
				products: [{ name: "Free Entry", price: 0, maxQuantity: 100 }],
				salesStartOffset: -1,
				salesEndOffset: 30,
				needsTicket: false,
			},
			true,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(page.locator('button:has-text("✓ Going")')).toBeVisible({
			timeout: 5_000,
		});
		await page.click('button:has-text("✓ Going")');
		await expect(
			page
				.locator("text=✓ You're attending!")
				.or(page.locator("text=✓ You're Going!")),
		).toBeVisible({ timeout: 5_000 });
	});

	test("free-event RSVP can be changed without page reload", async ({
		memberPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "RSVP Toggle State Event (per-test)",
				startOffsetDays: 10,
				city: "Berlin",
				products: [{ name: "Free Entry", price: 0, maxQuantity: 100 }],
				salesStartOffset: -1,
				salesEndOffset: 30,
				needsTicket: false,
			},
			true,
		);

		await page.goto(`/events/${ev.id}`);

		await expect(page.locator('button:has-text("✓ Going")')).toBeVisible({
			timeout: 5_000,
		});
		await page.click('button:has-text("✓ Going")');

		// After successful RSVP=yes, the tri-state participation toggle should render.
		await expect(page.locator('button:has-text("? Maybe")')).toBeVisible({
			timeout: 5_000,
		});

		await page.click('button:has-text("? Maybe")');

		// The action does a 303 redirect — wait for the page to reload before asserting ring-2.
		await page.waitForLoadState("networkidle");
		await expect(page.locator('button:has-text("? Maybe")')).toHaveClass(
			/ring-2/,
			{ timeout: 15_000 },
		);
	});

	test("logged-in user can navigate to checkout for a ticketed event", async ({
		memberPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Cologne Members Dinner (per-test)",
				startOffsetDays: 9,
				city: "Cologne",
				products: [{ name: "Dinner Ticket", price: 25.0, maxQuantity: 5 }],
				salesStartOffset: -1,
				salesEndOffset: 30,
			},
			true,
		);
		await page.goto(`/events/${ev.id}`);
		await page.click(`a[href="/events/${ev.id}/checkout"]`);
		await page.waitForURL(/\/events\/.+\/checkout/, { timeout: 15_000 });
		await expect(
			page
				.locator('h1:has-text("Purchase Tickets")')
				.or(page.locator('h2:has-text("Tickets")')),
		).toBeVisible();
	});

	test("logged-in user can join the waitlist for an event without ticket sales", async ({
		memberPage: page,
	}) => {
		const ev = await createEventWithInventory(
			{
				title: "Hamburg Harbour Morning Walk (per-test)",
				startOffsetDays: 6,
				city: "Hamburg",
				products: [],
			},
			false,
		);
		await page.goto(`/events/${ev.id}`);
		await expect(page.locator("text=Join Waitlist")).toBeVisible({
			timeout: 5_000,
		});
		await page.click("text=Join Waitlist");
		await expect(page.locator("text=✓ You're on the waitlist!")).toBeVisible({
			timeout: 5_000,
		});
	});
});

// =============================================================================
// Event page: privacy and visibility
// =============================================================================

test.describe("Events — public page data and visibility", () => {
	test("the page does not serialize the organizer email or private user fields", async ({
		guestPage: page,
	}) => {
		const organizer = createUserSession("user", "e2e-organizer");
		const event = createGroupEventInDb({
			organizerId: organizer.userId,
			title: "Privacy Check Event",
		});
		try {
			const email = getUserEmailById(organizer.userId);
			expect(email).toBeTruthy();
			const res = await page.goto(`/events/${event.eventId}`);
			expect(res?.status()).toBe(200);
			const html = await page.content();
			expect(html).toContain("Privacy Check Event");
			expect(html).not.toContain(email as string);
			expect(html).not.toContain("loginId");
			expect(html).not.toContain("foodPreference");
		} finally {
			event.cleanup();
			organizer.cleanup();
		}
	});

	test("a group-only event is hidden from guests and non-members, visible to members", async ({
		browser,
	}) => {
		const organizer = createUserSession("user");
		const member = createUserSession("user");
		const outsider = createUserSession("user");
		const groupId = createGroupInDb({
			name: "Visibility Group",
			slug: `e2e-vis-${Date.now()}`,
		});
		addGroupMember(member.userId, groupId);
		const event = createGroupEventInDb({
			organizerId: organizer.userId,
			title: "Members Only Gathering",
			groupId,
			visibility: "group-only",
		});
		const open = async (
			userSession: ReturnType<typeof createUserSession> | null,
		) => {
			const ctx = await browser.newContext();
			if (userSession) {
				await ctx.addCookies([
					{
						name: "session",
						value: userSession.sessionToken,
						domain: "localhost",
						path: "/",
						httpOnly: true,
						secure: false,
						sameSite: "Strict",
					},
				]);
			}
			const page = await ctx.newPage();
			const res = await page.goto(`/events/${event.eventId}`);
			const html = await page.content();
			await ctx.close();
			return { status: res?.status(), html };
		};
		try {
			for (const viewer of [null, outsider]) {
				const { status, html } = await open(viewer);
				expect(status).toBe(404);
				expect(html).not.toContain("Members Only Gathering");
			}
			const asMember = await open(member);
			expect(asMember.status).toBe(200);
			expect(asMember.html).toContain("Members Only Gathering");
		} finally {
			event.cleanup();
			deleteGroupMember(member.userId, groupId);
			deleteGroupInDb(groupId);
			for (const u of [organizer, member, outsider]) u.cleanup();
		}
	});
});

// =============================================================================
// Profile shows participation
// =============================================================================

test.describe("Events — profile participation", () => {
	test("/profile lists upcoming and past events the user said yes to", async ({
		browser,
	}) => {
		const user = createUserSession("user");
		const upcoming = createGroupEventInDb({
			organizerId: user.userId,
			title: "Profile Upcoming Event",
		});
		const past = createGroupEventInDb({
			organizerId: user.userId,
			title: "Profile Past Event",
			past: true,
		});
		const declined = createGroupEventInDb({
			organizerId: user.userId,
			title: "Profile Declined Event",
		});
		setParticipationInDb(user.userId, upcoming.eventId, "yes");
		setParticipationInDb(user.userId, past.eventId, "yes");
		setParticipationInDb(user.userId, declined.eventId, "no");
		const ctx = await browser.newContext();
		await ctx.addCookies([
			{
				name: "session",
				value: user.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		const page = await ctx.newPage();
		try {
			await page.goto("/profile");
			await expect(page.locator("text=Profile Upcoming Event")).toBeVisible();
			await expect(page.locator("text=Profile Past Event")).toBeVisible();
			await expect(page.locator("text=Profile Declined Event")).toHaveCount(0);

			// Another member sees the same on the public profile.
			const viewer = createUserSession("user");
			const vctx = await browser.newContext();
			await vctx.addCookies([
				{
					name: "session",
					value: viewer.sessionToken,
					domain: "localhost",
					path: "/",
					httpOnly: true,
					secure: false,
					sameSite: "Strict",
				},
			]);
			const vpage = await vctx.newPage();
			await vpage.goto(`/users/${user.userId}`);
			await expect(vpage.locator("text=Profile Upcoming Event")).toBeVisible();
			await vctx.close();
			viewer.cleanup();
		} finally {
			await ctx.close();
			for (const e of [upcoming, past, declined]) e.cleanup();
			user.cleanup();
		}
	});
});

// =============================================================================
// Admin scope: a representative manages only their own group's events
// =============================================================================

test.describe("Events — admin scope", () => {
	const suffix = Date.now();
	const slugA = `e2e-scope-a-${suffix}`;
	const slugB = `e2e-scope-b-${suffix}`;
	let groupA: string;
	let groupB: string;
	let repA: ReturnType<typeof createUserSession>;
	let repAB: ReturnType<typeof createUserSession>;
	let eventA: ReturnType<typeof createGroupEventInDb>;
	let eventB: ReturnType<typeof createGroupEventInDb>;

	test.beforeAll(() => {
		groupA = createGroupInDb({ name: "Scope Group A", slug: slugA });
		groupB = createGroupInDb({ name: "Scope Group B", slug: slugB });
		// src/routes/admin/layout.tsx only lets platform admins into /admin/*, so a group
		// representative reaches a group's admin only when they are also a platform admin.
		repA = createUserSession("admin");
		repAB = createUserSession("admin");
		for (const [u, g] of [
			[repA, groupA],
			[repAB, groupA],
			[repAB, groupB],
		] as const) {
			addGroupMember(u.userId, g);
			addGroupRepresentative(u.userId, g);
		}
		eventA = createGroupEventInDb({
			organizerId: repA.userId,
			title: "Scope Event Of A",
			groupId: groupA,
		});
		eventB = createGroupEventInDb({
			organizerId: repA.userId,
			title: "Scope Event Of B",
			groupId: groupB,
		});
	});

	test.afterAll(() => {
		eventA.cleanup();
		eventB.cleanup();
		for (const [u, g] of [
			[repA, groupA],
			[repAB, groupA],
			[repAB, groupB],
		] as const) {
			deleteGroupRepresentative(u.userId, g);
			deleteGroupMember(u.userId, g);
		}
		deleteGroupInDb(groupA);
		deleteGroupInDb(groupB);
		repA.cleanup();
		repAB.cleanup();
	});

	async function pageFor(
		browser: import("@playwright/test").Browser,
		s: ReturnType<typeof createUserSession>,
	) {
		const ctx = await browser.newContext();
		await ctx.addCookies([
			{
				name: "session",
				value: s.sessionToken,
				domain: "localhost",
				path: "/",
				httpOnly: true,
				secure: false,
				sameSite: "Strict",
			},
		]);
		return { ctx, page: await ctx.newPage() };
	}

	test("a representative can open their own group event admin pages", async ({
		browser,
	}) => {
		const { ctx, page } = await pageFor(browser, repA);
		try {
			for (const tab of [
				"details",
				"edit",
				"products",
				"tickets",
				"transactions",
				"participation",
			]) {
				const res = await page.goto(
					`/admin/${slugA}/events/${eventA.eventId}/${tab}`,
				);
				expect(res?.status(), tab).toBe(200);
			}
			await page.goto(`/admin/${slugA}/events/${eventA.eventId}/details`);
			await expect(page.locator('input[name="title"]')).toHaveValue(
				"Scope Event Of A",
			);
			await page.goto(`/admin/${slugA}/events`);
			await expect(page.locator("text=Scope Event Of A")).toBeVisible();
			await expect(page.locator("text=Scope Event Of B")).toHaveCount(0);
		} finally {
			await ctx.close();
		}
	});

	test("a representative of A cannot open a group-B event under either slug", async ({
		browser,
	}) => {
		const { ctx, page } = await pageFor(browser, repA);
		try {
			// Own slug, foreign event id.
			for (const tab of [
				"details",
				"edit",
				"products",
				"tickets",
				"transactions",
				"participation",
				"photos",
				"attendance",
				"scan",
			]) {
				const res = await page.goto(
					`/admin/${slugA}/events/${eventB.eventId}/${tab}`,
				);
				expect(res?.status(), tab).toBe(403);
				expect(await page.content()).not.toContain("Scope Event Of B");
			}
			// Foreign slug: not a representative of B at all.
			await page.goto(`/admin/${slugB}/events/${eventB.eventId}/details`);
			await expect(page).not.toHaveURL(/\/admin\//);
		} finally {
			await ctx.close();
		}
	});

	test("a representative of both groups cannot reach A's event under B's slug", async ({
		browser,
	}) => {
		const { ctx, page } = await pageFor(browser, repAB);
		try {
			const res = await page.goto(
				`/admin/${slugB}/events/${eventA.eventId}/details`,
			);
			expect(res?.status()).toBe(403);
			expect(await page.content()).not.toContain("Scope Event Of A");
			const own = await page.goto(
				`/admin/${slugB}/events/${eventB.eventId}/details`,
			);
			expect(own?.status()).toBe(200);
		} finally {
			await ctx.close();
		}
	});
});
