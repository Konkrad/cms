/**
 * E2E tests for /profile/tickets — the ticket overview page.
 *
 * Two components are under test:
 *  - QrTicketWall ("My Tickets" section) — event-card buttons that open a QR modal.
 *    Only shows tickets where the participant is the buyer themselves or an external guest.
 *  - PurchaseList ("Purchases" section) — expandable transaction history with per-ticket
 *    Reassign buttons (upcoming only).
 */

import {
  test,
  expect,
  createUserSession,
  createTestEventWithProduct,
  createTicketInDb,
  addParticipantToTicket,
  getUserEmailById,
} from "../fixtures";

function authCookies(token: string) {
  return [{ name: "session", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" as const }];
}

test.describe("Profile — Purchases section", () => {
  test("shows empty state when user has no purchases", async ({ browser }) => {
    const session = createUserSession("user");
    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("No purchases yet")).toBeVisible();
    } finally {
      await ctx.close();
      session.cleanup();
    }
  });

  test("shows upcoming transaction with Reassign button", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const purchases = page.locator("div").filter({ has: page.locator('h3:has-text("Purchases")') });
      await expect(purchases.getByText(/Upcoming/)).toBeVisible();
      // Expand the transaction
      await purchases.locator('div[role="button"]:has-text("Ticket Test Event")').click();
      await expect(purchases.getByText("Standard Ticket")).toBeVisible();
      await expect(purchases.getByRole("button", { name: "Reassign" })).toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("shows past transaction without Reassign button", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: false });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const purchases = page.locator("div").filter({ has: page.locator('h3:has-text("Purchases")') });
      await expect(purchases.getByText(/Past/)).toBeVisible();
      await purchases.locator('div[role="button"]:has-text("Ticket Test Event")').click();
      await expect(purchases.getByText("Standard Ticket")).toBeVisible();
      await expect(purchases.getByRole("button", { name: "Reassign" })).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("shows no amber badge for unassigned ticket", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const purchases = page.locator("div").filter({ has: page.locator('h3:has-text("Purchases")') });
      await purchases.locator('div[role="button"]:has-text("Ticket Test Event")').click();
      await expect(purchases.getByText("Standard Ticket")).toBeVisible();
      await expect(purchases.locator(".text-amber-700")).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("shows no amber badge when ticket is assigned to self", async ({ browser }) => {
    const session = createUserSession("user");
    const email = getUserEmailById(session.userId)!;
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Test User", email });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const purchases = page.locator("div").filter({ has: page.locator('h3:has-text("Purchases")') });
      await purchases.locator('div[role="button"]:has-text("Ticket Test Event")').click();
      await expect(purchases.getByText("Standard Ticket")).toBeVisible();
      await expect(purchases.locator(".text-amber-700")).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("shows amber badge when ticket is assigned to someone else", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Jane Smith", email: "jane@example.com" });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const purchases = page.locator("div").filter({ has: page.locator('h3:has-text("Purchases")') });
      await purchases.locator('div[role="button"]:has-text("Ticket Test Event")').click();
      const badge = purchases.locator(".text-amber-700");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("Jane Smith");
      await expect(badge).not.toContainText("jane@example.com");
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("buyer can reassign ticket via Reassign form", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const purchases = page.locator("div").filter({ has: page.locator('h3:has-text("Purchases")') });
      await purchases.locator('div[role="button"]:has-text("Ticket Test Event")').click();
      await purchases.getByRole("button", { name: "Reassign" }).click();
      await page.getByPlaceholder("Search participant by name…").focus();
      await page.getByText("Add manually").click();
      await page.getByPlaceholder("Full name").fill("Alice Example");
      await page.getByPlaceholder("Email address").fill("alice@example.com");
      await page.getByRole("button", { name: "Add" }).click();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(purchases.locator(".text-amber-700")).toBeVisible({ timeout: 5000 });
      await expect(purchases.locator(".text-amber-700")).toContainText("Alice Example");
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });
});

test.describe("Profile — My Tickets QR wall", () => {
  test("shows event card when ticket is assigned to self", async ({ browser }) => {
    const session = createUserSession("user");
    const email = getUserEmailById(session.userId)!;
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Test User", email });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const myTickets = page.locator("div").filter({ has: page.locator('h3:has-text("My Tickets")') });
      await expect(myTickets.locator('button:has-text("Ticket Test Event")')).toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("QR modal opens with event title and QR image", async ({ browser }) => {
    const session = createUserSession("user");
    const email = getUserEmailById(session.userId)!;
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Test User", email });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const myTickets = page.locator("div").filter({ has: page.locator('h3:has-text("My Tickets")') });
      await myTickets.locator('button:has-text("Ticket Test Event")').click();
      // Modal shows event title as heading
      await expect(page.locator('h2:has-text("Ticket Test Event")')).toBeVisible();
      await expect(page.locator('img[alt="Ticket QR Code"]')).toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("QR modal can be closed", async ({ browser }) => {
    const session = createUserSession("user");
    const email = getUserEmailById(session.userId)!;
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Test User", email });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const myTickets = page.locator("div").filter({ has: page.locator('h3:has-text("My Tickets")') });
      await myTickets.locator('button:has-text("Ticket Test Event")').click();
      await expect(page.locator('img[alt="Ticket QR Code"]')).toBeVisible();
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.locator('img[alt="Ticket QR Code"]')).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("ticket assigned to viewer by owner appears in viewer's My Tickets", async ({ browser }) => {
    const owner = createUserSession("user");
    const viewer = createUserSession("user");
    const viewerEmail = getUserEmailById(viewer.userId)!;

    const event = createTestEventWithProduct({ ownerId: owner.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: owner.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Viewer User", email: viewerEmail });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(viewer.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      const myTickets = page.locator("div").filter({ has: page.locator('h3:has-text("My Tickets")') });
      await expect(myTickets.locator('button:has-text("Ticket Test Event")')).toBeVisible();
      // QR modal also works for assigned tickets
      await myTickets.locator('button:has-text("Ticket Test Event")').click();
      await expect(page.locator('img[alt="Ticket QR Code"]')).toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      owner.cleanup();
      viewer.cleanup();
    }
  });

  test("does not show event card when ticket is not assigned to self", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    // Ticket has no participant → excluded from My Tickets wall
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies(authCookies(session.sessionToken));
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.locator('h3:has-text("My Tickets")')).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });
});
