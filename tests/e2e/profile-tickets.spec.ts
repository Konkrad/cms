/**
 * E2E tests for /profile/tickets — the ticket overview page.
 *
 * Covers:
 *  - Empty state
 *  - Upcoming / past ticket grouping
 *  - "Assign" button only visible on upcoming tickets (not past, not assigned-to-me)
 *  - Assigned-away amber badge when participant is a different person
 *  - No badge when ticket is unassigned or assigned to self
 *  - QR Code modal opens and displays an image
 *  - "Assigned to me" section for tickets where the viewer is a participant
 */

import { test, expect, createUserSession, createTestEventWithProduct, createTicketInDb, addParticipantToTicket, getUserEmailById } from "../fixtures";

test.describe("Profile — My Tickets", () => {
  test("shows empty state when user has no tickets", async ({ browser }) => {
    const session = createUserSession("user");
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("You don't have any tickets")).toBeVisible();
    } finally {
      await ctx.close();
      session.cleanup();
    }
  });

  test("shows upcoming ticket in Upcoming section with Assign button", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("Upcoming (1)")).toBeVisible();
      await expect(page.getByText("Standard Ticket")).toBeVisible();
      await expect(page.getByRole("button", { name: "Assign" })).toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("shows past ticket in Past section without Assign button", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: false });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("Past (1)")).toBeVisible();
      await expect(page.getByText("Standard Ticket")).toBeVisible();
      await expect(page.getByRole("button", { name: "Assign" })).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("shows no badge for unassigned ticket", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("Standard Ticket")).toBeVisible();
      // No amber assigned-away badge
      await expect(page.locator(".text-amber-700")).not.toBeVisible();
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
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("Standard Ticket")).toBeVisible();
      // No amber badge — it's their own ticket
      await expect(page.locator(".text-amber-700")).not.toBeVisible();
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
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await expect(page.getByText("Standard Ticket")).toBeVisible();
      // Amber badge shows assignee name (no email)
      const badge = page.locator(".text-amber-700");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText("Jane Smith");
      await expect(badge).not.toContainText("jane@example.com");
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("QR code modal opens and shows an image", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await page.getByRole("button", { name: "QR Code" }).click();
      // Modal is a styled div, not a dialog element — check for its title heading
      await expect(page.getByText("Ticket QR Code")).toBeVisible();
      await expect(page.locator('img[alt="Ticket QR Code"]')).toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("QR code modal can be closed", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await page.getByRole("button", { name: "QR Code" }).click();
      await expect(page.getByText("Ticket QR Code")).toBeVisible();
      // Close via the aria-label="Close" button on the modal
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByText("Ticket QR Code")).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });

  test("assigned-to-me ticket appears in Assigned to me section with QR button but no Assign button", async ({ browser }) => {
    const owner = createUserSession("user");
    const viewer = createUserSession("user");
    const viewerEmail = getUserEmailById(viewer.userId)!;

    const event = createTestEventWithProduct({ ownerId: owner.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: owner.userId, eventId: event.eventId, productId: event.productId });
    addParticipantToTicket(ticketId, { name: "Viewer User", email: viewerEmail });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: viewer.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      // Section heading includes count: "Assigned to me — Upcoming (1)"
      await expect(page.getByText(/Assigned to me — Upcoming/)).toBeVisible();
      await expect(page.getByText("Standard Ticket")).toBeVisible();
      // QR code visible for the assignee
      await expect(page.getByRole("button", { name: "QR Code" })).toBeVisible();
      // No Assign button — viewer doesn't own the ticket
      await expect(page.getByRole("button", { name: "Assign" })).not.toBeVisible();
    } finally {
      await ctx.close();
      event.cleanup();
      owner.cleanup();
      viewer.cleanup();
    }
  });

  test("buyer can save participant assignment via Assign form", async ({ browser }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });

    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "session", value: session.sessionToken, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Strict" }]);
    const page = await ctx.newPage();
    try {
      await page.goto("/profile/tickets");
      await page.getByRole("button", { name: "Assign" }).click();
      // The participant form defaults to search mode; focus the search input to reveal the "Add manually" option
      await page.getByPlaceholder("Search participant by name\u2026").focus();
      await page.getByText("Add manually").click();
      // Now in manual mode — fill name and email
      await page.getByPlaceholder("Full name").fill("Alice Example");
      await page.getByPlaceholder("Email address").fill("alice@example.com");
      await page.getByRole("button", { name: "Add" }).click();
      // Now click the outer Save button
      await page.getByRole("button", { name: "Save" }).click();
      // After save the form collapses; amber badge should now show
      await expect(page.locator(".text-amber-700")).toBeVisible({ timeout: 5000 });
      await expect(page.locator(".text-amber-700")).toContainText("Alice Example");
    } finally {
      await ctx.close();
      event.cleanup();
      session.cleanup();
    }
  });
});
