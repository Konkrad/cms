/**
 * E2E tests for the public QR image route:
 *   GET /profile/tickets/<ticketId>_<qrCodeUuid>
 *
 * The route is intentionally public (no auth) so email clients can
 * render QR codes inline. It returns image/png for all valid ticket IDs,
 * serving a "Ticket no longer valid" image when the UUID is stale.
 */

import { test, expect, createUserSession, createTestEventWithProduct, createTicketInDb, openDb } from "../fixtures";
import crypto from "crypto";

function getTicketRow(ticketId: string): { qr_code_uuid: string } {
  const db = openDb();
  const row = db.prepare("SELECT qr_code_uuid FROM tickets WHERE id = ?").get(ticketId) as { qr_code_uuid: string };
  db.close();
  return row;
}

test.describe("QR image route", () => {
  test("valid token returns 200 with image/png content-type", async ({ request }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    const { qr_code_uuid } = getTicketRow(ticketId);

    try {
      const response = await request.get(`/profile/tickets/${ticketId}_${qr_code_uuid}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
      const body = await response.body();
      expect(body.length).toBeGreaterThan(0);
    } finally {
      event.cleanup();
      session.cleanup();
    }
  });

  test("stale UUID (post-rotation) returns 200 with image/png", async ({ request }) => {
    const session = createUserSession("user");
    const event = createTestEventWithProduct({ ownerId: session.userId, isFuture: true });
    const ticketId = createTicketInDb({ buyerId: session.userId, eventId: event.eventId, productId: event.productId });
    const { qr_code_uuid: originalUuid } = getTicketRow(ticketId);

    // Rotate the UUID (simulates a participant reassignment)
    const newUuid = crypto.randomUUID();
    const db = openDb();
    db.prepare("UPDATE tickets SET qr_code_uuid = ? WHERE id = ?").run(newUuid, ticketId);
    db.close();

    try {
      // Old UUID → still returns a PNG (the "no longer valid" image)
      const response = await request.get(`/profile/tickets/${ticketId}_${originalUuid}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");

      // New UUID → valid QR
      const validResponse = await request.get(`/profile/tickets/${ticketId}_${newUuid}`);
      expect(validResponse.status()).toBe(200);
      expect(validResponse.headers()["content-type"]).toContain("image/png");

      // The two images are different (invalid vs valid QR)
      const oldBody = await response.body();
      const newBody = await validResponse.body();
      expect(oldBody).not.toEqual(newBody);
    } finally {
      event.cleanup();
      session.cleanup();
    }
  });

  test("unknown ticket ID returns 200 with image/png (invalid image)", async ({ request }) => {
    const response = await request.get(`/profile/tickets/${crypto.randomUUID()}_${crypto.randomUUID()}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("malformed token with no underscore returns 200 with image/png (invalid image)", async ({ request }) => {
    const response = await request.get(`/profile/tickets/not-a-valid-token`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });
});
