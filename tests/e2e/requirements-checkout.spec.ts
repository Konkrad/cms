/**
 * Event requirements (spec 4.6): food preference and photo consent are asked once, before the
 * ticket selection or the RSVP, and checked again by the actions on the server. Organisers see
 * the answers in the admin RSVP list.
 */
import type { Browser, Page } from "@playwright/test";
import {
	createTestEventWithProduct,
	createTestUser,
	createUserSession,
	expect,
	GLOBAL_REQUIREMENTS,
	getUserRequirement,
	setParticipationInDb,
	test,
} from "../fixtures";

async function pageFor(browser: Browser, sessionToken: string) {
	const ctx = await browser.newContext();
	await ctx.addCookies([
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
	return { ctx, page: await ctx.newPage() };
}

const step = (page: Page, id: string) =>
	page.locator(`[data-testid="requirement-step"][data-requirement="${id}"]`);

async function answerEventRequirements(page: Page) {
	const food = step(page, "events.foodPreference");
	await expect(food).toBeVisible({ timeout: 15000 });
	await expect(step(page, "events.photoConsent")).toHaveCount(0);
	await food.locator('select[name="foodPreference"]').selectOption("vegan");
	await food.locator('button[type="submit"]').click();

	const photo = step(page, "events.photoConsent");
	await expect(photo).toBeVisible({ timeout: 15000 });
	await photo.locator('label:has-text("Yes, I consent")').click();
	await photo.locator('button[type="submit"]').click();
	await expect(photo).toBeHidden({ timeout: 15000 });
}

async function buyFreeTicket(page: Page) {
	const radio = page.locator('input[type="radio"]').first();
	await expect(radio).toBeVisible({ timeout: 15000 });
	await radio.check();
	await page.click('button:has-text("Continue to Participants")');
	await page.click('button:has-text("Continue to Payment")');
	await expect(page.locator("text=Payment Successful!")).toBeVisible({
		timeout: 15000,
	});
}

test("checkout asks food preference and photo consent once, before the tickets", async ({
	browser,
}) => {
	const buyer = createTestUser({ completed: GLOBAL_REQUIREMENTS });
	const organiser = createUserSession("user", "e2e-organiser");
	const ev = createTestEventWithProduct({
		ownerId: organiser.userId,
		title: "Requirements Checkout Event",
	});
	const { ctx, page } = await pageFor(browser, buyer.sessionToken);
	try {
		await page.goto(`/events/${ev.eventId}/checkout`);
		await expect(page.getByTestId("checkout-requirements")).toBeVisible();
		// No ticket selection until the questions are answered.
		await expect(
			page.locator('button:has-text("Continue to Participants")'),
		).toHaveCount(0);

		await answerEventRequirements(page);
		expect(
			getUserRequirement(buyer.userId, "events.foodPreference")?.value,
		).toEqual({ foodPreference: "vegan" });
		expect(
			getUserRequirement(buyer.userId, "events.photoConsent")?.value,
		).toEqual({ photoConsentGiven: true });

		await buyFreeTicket(page);

		// Second purchase: nothing asked again.
		await page.goto(`/events/${ev.eventId}/checkout`);
		await expect(page.locator('h1:has-text("Purchase Tickets")')).toBeVisible();
		await expect(page.getByTestId("checkout-requirements")).toHaveCount(0);
		await buyFreeTicket(page);
	} finally {
		await ctx.close();
		ev.cleanup();
		buyer.cleanup();
		organiser.cleanup();
	}
});

test("the RSVP shows the steps first and registers once they are answered", async ({
	browser,
}) => {
	const member = createTestUser({ completed: GLOBAL_REQUIREMENTS });
	const organiser = createUserSession("user", "e2e-organiser");
	const ev = createTestEventWithProduct({
		ownerId: organiser.userId,
		title: "Requirements RSVP Event",
	});
	const { ctx, page } = await pageFor(browser, member.sessionToken);
	try {
		await page.goto(`/events/${ev.eventId}`);
		await expect(page.getByTestId("rsvp-requirements")).toBeVisible();
		await answerEventRequirements(page);
		await expect(page.getByTestId("rsvp-requirements")).toHaveCount(0);
	} finally {
		await ctx.close();
		ev.cleanup();
		member.cleanup();
		organiser.cleanup();
	}
});

test("the admin RSVP list shows food preference and photo consent", async ({
	adminPage: page,
}) => {
	const organiser = createUserSession("user", "e2e-organiser");
	const attendee = createUserSession(
		"user",
		"e2e-attendee",
		{ name: "Req", familyName: "Attendee" },
		{
			values: {
				"events.foodPreference": { foodPreference: "gluten_free" },
				"events.photoConsent": { photoConsentGiven: false },
			},
		},
	);
	const ev = createTestEventWithProduct({
		ownerId: organiser.userId,
		title: "Requirements Admin Event",
	});
	setParticipationInDb(attendee.userId, ev.eventId, "yes");
	try {
		await page.goto(`/admin/root/events/${ev.eventId}/participation`);
		const row = page.locator("tr", { hasText: "Req" });
		await expect(row).toBeVisible();
		await expect(row.getByTestId("participant-food")).toHaveText("Gluten-free");
		await expect(row.getByTestId("participant-photo")).toHaveText("No");
	} finally {
		ev.cleanup();
		attendee.cleanup();
		organiser.cleanup();
	}
});
