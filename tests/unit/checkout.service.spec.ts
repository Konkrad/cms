import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { paymentsService } from "~/core/payments/payments.service";
import { checkoutService } from "~/modules/events/services/checkout";
import { eventsService } from "~/modules/events/services/events";
import { inventoryGroupsService } from "~/modules/events/services/inventory-groups";
import { productsService } from "~/modules/events/services/products";
import { startTicketPayment } from "~/modules/events/services/ticket-checkout";
import { transactionsService } from "~/modules/events/services/transactions";
import { createTestUser, ensureRootScope, openDb } from "./helpers";

const cleanupEventIds: string[] = [];
const cleanupGroupIds: string[] = [];
const cleanupProductIds: string[] = [];
let cleanupUserId: (() => void) | null = null;

afterEach(() => {
	const db = openDb();
	for (const id of cleanupProductIds.splice(0))
		db.prepare("DELETE FROM products WHERE id = ?").run(id);
	for (const id of cleanupGroupIds.splice(0))
		db.prepare("DELETE FROM inventory_groups WHERE id = ?").run(id);
	for (const id of cleanupEventIds.splice(0))
		db.prepare("DELETE FROM events WHERE id = ?").run(id);
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
		scopeId: ensureRootScope(),
		visibility: "public",
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

		const result = await checkoutService.validateInventory(
			crypto.randomUUID(),
			[{ productId: product.id, quantity: 1 }],
		);

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

describe("startTicketPayment (spec 4.7)", () => {
	it("creates a pending order and a payment whose amount comes from the DB price", async () => {
		const { userId, cleanup } = createTestUser();
		const { event, product } = await createEventFixture(userId);

		const result = await startTicketPayment({
			eventId: event.id,
			eventUrl: "/events/checkout-test",
			userId,
			items: [
				// Whatever the request carried besides id and quantity is ignored.
				{
					productId: product.id,
					quantity: 2,
					participantUnits: [],
					price: 0.01,
					amount: 1,
				} as never,
			],
		});
		expect(result.url).toBeTruthy();

		const payment = await paymentsService.getById(result.paymentId);
		expect(payment).toMatchObject({
			moduleId: "events",
			kind: "tickets",
			userId,
			status: "pending",
			mode: "payment",
			amount: 3000,
			currency: "eur",
			subjectRef: `events:event:${event.id}`,
		});
		expect(payment?.lines).toEqual([
			{ label: "Standard Ticket", amount: 1500, quantity: 2 },
		]);
		expect(payment?.providerRef).toBeTruthy();
		const order = await transactionsService.getById(payment?.refId ?? "");
		expect(order).toMatchObject({
			status: "pending",
			paymentId: result.paymentId,
			totalAmount: 30,
		});

		const db = openDb();
		db.prepare("DELETE FROM transaction_items WHERE transaction_id = ?").run(
			order?.id,
		);
		db.prepare("DELETE FROM transactions WHERE id = ?").run(order?.id);
		db.prepare("DELETE FROM payments WHERE id = ?").run(result.paymentId);
		db.close();
		cleanupUserId = cleanup;
	});
});
