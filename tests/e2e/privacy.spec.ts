/**
 * Private-by-default page payloads. Every loader result passes through
 * assertNoPrivateFields in dev/test, so a page that leaks a private field fails
 * with a 500 here; the HTML checks make sure other users' emails and Stripe ids
 * never reach the browser.
 */
import {
	addParticipantToTicket,
	createElectionApplicationInDb,
	createElectionCycleInDb,
	createElectionPositionInDb,
	createTestEventWithProduct,
	createTicketInDb,
	createUserSession,
	expect,
	getUserEmailById,
	setParticipationInDb,
	test,
} from "../fixtures";

async function loginAs(page: import("@playwright/test").Page, token: string) {
	await page.context().addCookies([
		{
			name: "session",
			value: token,
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Strict",
		},
	]);
}

test.describe("Privacy — page payloads", () => {
	test("admin event pages with tickets, RSVPs and transactions load (leak check passes)", async ({
		guestPage: page,
	}) => {
		const admin = createUserSession("admin");
		const buyer = createUserSession("user");
		const ev = createTestEventWithProduct({ ownerId: admin.userId });
		const ticketId = createTicketInDb({
			buyerId: buyer.userId,
			eventId: ev.eventId,
			productId: ev.productId,
		});
		addParticipantToTicket(ticketId, {
			name: "Test User",
			email: getUserEmailById(buyer.userId) ?? "x@example.com",
			userId: buyer.userId,
		});
		setParticipationInDb(buyer.userId, ev.eventId, "yes");
		try {
			await loginAs(page, admin.sessionToken);
			for (const sub of [
				"details",
				"edit",
				"tickets",
				"attendance",
				"transactions",
				"participation",
				"products",
				"comp-tickets",
				"scan",
			]) {
				const res = await page.goto(`/admin/root/events/${ev.eventId}/${sub}`);
				expect(res?.status(), sub).toBeLessThan(400);
			}
		} finally {
			ev.cleanup();
			admin.cleanup();
			buyer.cleanup();
		}
	});

	test("public event page never contains the organizer's or attendees' emails", async ({
		guestPage: page,
	}) => {
		const organizer = createUserSession("user");
		const attendee = createUserSession("user");
		const ev = createTestEventWithProduct({ ownerId: organizer.userId });
		setParticipationInDb(attendee.userId, ev.eventId, "yes");
		try {
			const res = await page.goto(`/events/${ev.eventId}`);
			expect(res?.status()).toBe(200);
			const html = await page.content();
			for (const email of [
				getUserEmailById(organizer.userId),
				getUserEmailById(attendee.userId),
			]) {
				expect(email).toBeTruthy();
				expect(html).not.toContain(email as string);
			}
		} finally {
			ev.cleanup();
			organizer.cleanup();
			attendee.cleanup();
		}
	});

	test("/profile/tickets hides other participants' emails and Stripe ids", async ({
		guestPage: page,
	}) => {
		const organizer = createUserSession("admin");
		const buyer = createUserSession("user");
		const friend = createUserSession("user");
		const friendEmail = getUserEmailById(friend.userId) as string;
		const ev = createTestEventWithProduct({ ownerId: organizer.userId });
		const ticketId = createTicketInDb({
			buyerId: buyer.userId,
			eventId: ev.eventId,
			productId: ev.productId,
		});
		addParticipantToTicket(ticketId, {
			name: "Friend Person",
			email: friendEmail,
			userId: friend.userId,
		});
		try {
			await loginAs(page, buyer.sessionToken);
			const res = await page.goto("/profile/tickets");
			expect(res?.status()).toBe(200);
			const html = await page.content();
			expect(html).toContain("Friend Person");
			expect(html).not.toContain(friendEmail);
			// createTicketInDb stores Stripe ids prefixed with "free_".
			expect(html).not.toContain("free_");
		} finally {
			ev.cleanup();
			organizer.cleanup();
			buyer.cleanup();
			friend.cleanup();
		}
	});

	test("admin election cycle page with an admin note loads", async ({
		guestPage: page,
	}) => {
		const admin = createUserSession("admin");
		const applicant = createUserSession("user");
		const cycle = createElectionCycleInDb({ status: "open" });
		const position = createElectionPositionInDb(cycle.cycleId);
		const app = createElectionApplicationInDb(
			position.positionId,
			cycle.cycleId,
			applicant.userId,
			"rejected",
			"Internal note",
		);
		try {
			await loginAs(page, admin.sessionToken);
			const res = await page.goto(`/admin/root/elections/${cycle.cycleId}`);
			expect(res?.status()).toBeLessThan(400);
			await expect(page.getByText("Internal note")).toBeVisible();
		} finally {
			app.cleanup();
			position.cleanup();
			cycle.cleanup();
			admin.cleanup();
			applicant.cleanup();
		}
	});
});
