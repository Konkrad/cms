import { describe, it, expect, afterEach } from "vitest";
import { eventsService } from "~/services/events.service";
import { createTestUser, openDb } from "./helpers";
import crypto from "crypto";

const cleanupEventIds: string[] = [];
let cleanupUser: (() => void) | null = null;

afterEach(() => {
  const db = openDb();
  for (const id of cleanupEventIds.splice(0)) {
    db.prepare("DELETE FROM products WHERE event_id = ?").run(id);
    db.prepare("DELETE FROM inventory_groups WHERE event_id = ?").run(id);
    db.prepare("DELETE FROM events WHERE id = ?").run(id);
  }
  db.close();
  cleanupUser?.();
  cleanupUser = null;
});

function makeEventData(userId: string, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 7 * 86400000);
  const end = new Date(Date.now() + 7 * 86400000 + 7200000);
  return {
    title: "Test Event",
    body: "<p>test body</p>",
    startDate: start,
    endDate: end,
    locationType: "online",
    userId,
    visibility: "global",
    ...overrides,
  } as any;
}

describe("eventsService.create + getById", () => {
  it("creates an event and retrieves it by id", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const event = await eventsService.create(makeEventData(userId));
    cleanupEventIds.push(event.id);

    const fetched = await eventsService.getById(event.id);
    expect(fetched).toBeTruthy();
    expect(fetched!.title).toBe("Test Event");
    expect(fetched!.userId).toBe(userId);
  });

  it("getById returns undefined for a non-existent id", async () => {
    const result = await eventsService.getById("00000000-0000-0000-0000-000000000000");
    expect(result).toBeUndefined();
  });
});

describe("eventsService.update", () => {
  it("updates the title of an existing event", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const event = await eventsService.create(makeEventData(userId));
    cleanupEventIds.push(event.id);

    const updated = await eventsService.update(event.id, { title: "Updated Title" });
    expect(updated!.title).toBe("Updated Title");
  });
});

describe("eventsService.softDelete", () => {
  it("soft-deletes an event so getById returns undefined", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const event = await eventsService.create(makeEventData(userId));
    cleanupEventIds.push(event.id);

    await eventsService.softDelete(event.id, userId);

    const fetched = await eventsService.getById(event.id);
    expect(fetched).toBeUndefined();
  });
});

describe("eventsService.getUpcoming", () => {
  it("includes a future event and excludes a past one", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const past = await eventsService.create(
      makeEventData(userId, {
        startDate: new Date(Date.now() - 10 * 86400000),
        endDate: new Date(Date.now() - 9 * 86400000),
      }),
    );
    cleanupEventIds.push(past.id);

    const future = await eventsService.create(makeEventData(userId));
    cleanupEventIds.push(future.id);

    const upcoming = await eventsService.getUpcoming();
    const ids = upcoming.map((e) => e.id);

    expect(ids).toContain(future.id);
    expect(ids).not.toContain(past.id);
  });
});

describe("eventsService.isFreeEvent", () => {
  it("returns true when event has a product with price 0", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const event = await eventsService.create(makeEventData(userId));
    cleanupEventIds.push(event.id);

    // Insert a free product directly — avoids Stripe call in productsService.create
    const db = openDb();
    const groupId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket) VALUES (?, ?, ?, ?, ?)",
    ).run(groupId, event.id, "General", 10, 1);
    db.prepare(
      "INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(crypto.randomUUID(), event.id, groupId, "Free Ticket", 0, 1, 1, "[]");
    db.close();

    const free = await eventsService.isFreeEvent(event.id);
    expect(free).toBe(true);
  });

  it("returns false when event has no products", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUser = cleanup;

    const event = await eventsService.create(makeEventData(userId));
    cleanupEventIds.push(event.id);

    const free = await eventsService.isFreeEvent(event.id);
    expect(free).toBe(false);
  });
});
