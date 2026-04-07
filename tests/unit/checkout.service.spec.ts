import { describe, it, expect, afterEach } from "vitest";
import { checkoutService } from "~/services/checkout.service";
import { stripeService } from "~/services/stripe.service";
import { eventsService } from "~/services/events.service";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { productsService } from "~/services/products.service";
import { createTestUser, openDb } from "./helpers";
import crypto from "crypto";

const cleanupEventIds: string[] = [];
const cleanupGroupIds: string[] = [];
const cleanupProductIds: string[] = [];
let cleanupUserId: (() => void) | null = null;

afterEach(() => {
  const db = openDb();
  for (const id of cleanupProductIds.splice(0)) db.prepare("DELETE FROM products WHERE id = ?").run(id);
  for (const id of cleanupGroupIds.splice(0)) db.prepare("DELETE FROM inventory_groups WHERE id = ?").run(id);
  for (const id of cleanupEventIds.splice(0)) db.prepare("DELETE FROM events WHERE id = ?").run(id);
  db.close();
  cleanupUserId?.();
  cleanupUserId = null;
});

/** Insert an event + one inventory group + one product using services, return ids. */
async function createEventFixture(userId: string) {
  const start = new Date(Date.now() + 7 * 86400000);
  const end = new Date(Date.now() + 7 * 86400000 + 7200000);

  const event = await eventsService.create({
    title: "Checkout Test Event",
    body: "<p>test</p>",
    startDate: start,
    endDate: end,
    locationType: "online",
    userId,
    visibility: "global",
  } as any);
  cleanupEventIds.push(event.id);

  const group = await inventoryGroupsService.create({
    eventId: event.id,
    name: "General",
    maxCapacity: 10,
    needsTicket: true,
  } as any);
  cleanupGroupIds.push(group.id);

  const product = await productsService.create({
    eventId: event.id,
    inventoryGroupId: group.id,
    name: "Standard Ticket",
    price: 15.0,
    maxQuantity: 2,
    participantCapacity: 1,
    features: [],
  } as any);
  cleanupProductIds.push(product.id);

  return { event, group, product };
}

describe("stripeService.createCheckoutSession", () => {
  it("creates a checkout session and returns a session id and url", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { event, product } = await createEventFixture(userId);

    const session = await stripeService.createCheckoutSession({
      lineItems: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: product.name },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: 1,
        },
      ],
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
      metadata: { eventId: event.id, userId, items: "[]" },
    });

    expect(session.id).toBeTruthy();
    // stripe-mock always returns a url
    expect(typeof session.url).toBe("string");
  });
});

describe("checkoutService.validateInventory", () => {
  it("returns valid:true when capacity is available", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { event, product } = await createEventFixture(userId);

    const result = await checkoutService.validateInventory(event.id, [
      { productId: product.id, quantity: 1 },
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a product that exceeds maxQuantity per purchase", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { event, product } = await createEventFixture(userId);

    const result = await checkoutService.validateInventory(event.id, [
      { productId: product.id, quantity: 99 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/maximum/i);
  });

  it("rejects a product that belongs to a different event", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { product } = await createEventFixture(userId);

    const result = await checkoutService.validateInventory(crypto.randomUUID(), [
      { productId: product.id, quantity: 1 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/does not belong/i);
  });

  it("rejects a non-existent product id", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { event } = await createEventFixture(userId);

    const result = await checkoutService.validateInventory(event.id, [
      { productId: crypto.randomUUID(), quantity: 1 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not found/i);
  });
});

describe("checkoutService.createSession", () => {
  it("returns a stripe session url on success", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { event, product } = await createEventFixture(userId);

    const result = await checkoutService.createSession({
      eventId: event.id,
      userId,
      items: [{ productId: product.id, quantity: 1 }],
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.sessionId).toBeTruthy();
      expect(result.url).toBeTruthy();
    }
  });

  it("returns an error object when inventory is invalid", async () => {
    const { userId, cleanup } = createTestUser();
    cleanupUserId = cleanup;
    const { event, product } = await createEventFixture(userId);

    const result = await checkoutService.createSession({
      eventId: event.id,
      userId,
      items: [{ productId: product.id, quantity: 99 }],
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/maximum/i);
  });
});
