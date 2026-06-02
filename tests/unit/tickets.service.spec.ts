import { describe, it, expect, afterEach } from "vitest";
import { ticketsService } from "~/services/tickets.service";
import { createTestUser, openDb } from "./helpers";
import crypto from "crypto";

// IDs cleaned up after each test
const cleanupEventIds: string[] = [];
const cleanupProductIds: string[] = [];
const cleanupGroupIds: string[] = [];
let cleanupUser: (() => void) | null = null;

afterEach(() => {
  const db = openDb();
  for (const id of cleanupEventIds.splice(0)) {
    db.prepare("DELETE FROM ticket_participants WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = ?)").run(id);
    db.prepare("DELETE FROM tickets WHERE event_id = ?").run(id);
    db.prepare("DELETE FROM transactions WHERE event_id = ?").run(id);
    db.prepare("DELETE FROM products WHERE event_id = ?").run(id);
    db.prepare("DELETE FROM inventory_groups WHERE event_id = ?").run(id);
    db.prepare("DELETE FROM events WHERE id = ?").run(id);
  }
  for (const id of cleanupProductIds.splice(0)) db.prepare("DELETE FROM products WHERE id = ?").run(id);
  for (const id of cleanupGroupIds.splice(0)) db.prepare("DELETE FROM inventory_groups WHERE id = ?").run(id);
  db.close();
  cleanupUser?.();
  cleanupUser = null;
});

/** Insert an event + product + transaction + ticket, return their IDs. */
function createTicketFixture(userId: string, eventOffset = 7) {
  const db = openDb();
  const eventId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();
  const ticketId = crypto.randomUUID();
  const qrCodeUuid = crypto.randomUUID();

  const start = new Date(Date.now() + eventOffset * 86400000).toISOString();
  const end = new Date(Date.now() + eventOffset * 86400000 + 7200000).toISOString();

  db.prepare(
    `INSERT INTO events (id, title, body, start_date, end_date, location_type, user_id, visibility)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(eventId, "Scan Test Event", "<p>test</p>", start, end, "online", userId, "global");

  db.prepare(
    `INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(groupId, eventId, "General", 100, 1);

  db.prepare(
    `INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(productId, eventId, groupId, "Standard Ticket", 0, 10, 1, "[]");

  db.prepare(
    `INSERT INTO transactions (id, user_id, event_id, total_amount, transaction_fee, stripe_session_id, stripe_payment_id)
     VALUES (?, ?, ?, 0, 0, ?, ?)`,
  ).run(transactionId, userId, eventId, `free_${crypto.randomUUID()}`, `free_${crypto.randomUUID()}`);

  db.prepare(
    `INSERT INTO tickets (id, qr_code_uuid, transaction_id, product_id, event_id, buyer_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(ticketId, qrCodeUuid, transactionId, productId, eventId, userId);

  db.close();

  cleanupEventIds.push(eventId);
  cleanupGroupIds.push(groupId);
  cleanupProductIds.push(productId);

  return { eventId, productId, ticketId, qrCodeUuid };
}

describe("ticketsService.scanTicket", () => {
  it("successfully scans a valid ticket", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;
    const { eventId, qrCodeUuid } = createTicketFixture(userId);

    const result = await ticketsService.scanTicket(qrCodeUuid, eventId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.scannedAt).not.toBeNull();
    }
  });

  it("returns error for unknown qrCodeUuid", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;
    const { eventId } = createTicketFixture(userId);

    const result = await ticketsService.scanTicket(crypto.randomUUID(), eventId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/invalid qr code/i);
    }
  });

  it("returns error when eventId does not match the ticket", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;
    const { qrCodeUuid } = createTicketFixture(userId);

    const result = await ticketsService.scanTicket(qrCodeUuid, crypto.randomUUID());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/different event/i);
    }
  });

  it("returns error when ticket is already scanned", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;
    const { eventId, qrCodeUuid } = createTicketFixture(userId);

    // First scan succeeds
    const first = await ticketsService.scanTicket(qrCodeUuid, eventId);
    expect(first.success).toBe(true);

    // Second scan fails
    const second = await ticketsService.scanTicket(qrCodeUuid, eventId);
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error).toMatch(/already scanned/i);
    }
  });

  it("rotateQrCode invalidates the old UUID for scanning", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;
    const { eventId, ticketId, qrCodeUuid: originalUuid } = createTicketFixture(userId);

    // Rotate the QR code (simulates reassignment)
    await ticketsService.rotateQrCode(ticketId);

    // Old UUID no longer works
    const result = await ticketsService.scanTicket(originalUuid, eventId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/invalid qr code/i);
    }
  });

  it("new UUID works after rotation", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;
    const { eventId, ticketId } = createTicketFixture(userId);

    const updated = await ticketsService.rotateQrCode(ticketId);
    expect(updated).toBeDefined();

    const result = await ticketsService.scanTicket(updated!.qrCodeUuid, eventId);
    expect(result.success).toBe(true);
  });
});
