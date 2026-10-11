/**
 * Events on the notification system: a paid ticket queues the buyer's confirmation email and
 * the Telegram "new sale" alert to the ops channel; the worker sends both (Mailpit container,
 * tests/utils/telegram-mock.ts). Test plan in notifications.spec.ts.
 */
import crypto from "node:crypto";
import type Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "~/core/db/connection";
import { notificationOutbox } from "~/core/notifications/schema";
import { processOutboxOnce } from "~/core/notifications/worker";
import { onTicketsPaid } from "~/modules/events/payments";
import {
	getTelegramMessages,
	startTelegramMock,
	stopTelegramMock,
} from "../utils/telegram-mock";
import { createTestEvent, createTestUser, openDb } from "./helpers";

const TELEGRAM_PORT = 8097;
// Before ~/env is loaded: route the Telegram channel to the mock server.
vi.hoisted(() => {
	process.env.TELEGRAM_API_URL = "http://localhost:8097";
});

const mailpit = process.env.MAILPIT_API_URL ?? "http://localhost:8025";
const cleanups: Array<() => void> = [];

beforeAll(async () => {
	await startTelegramMock(TELEGRAM_PORT);
	await db.delete(notificationOutbox);
}, 60_000);
afterAll(async () => {
	await stopTelegramMock();
	await db.delete(notificationOutbox);
	for (const fn of cleanups.splice(0).reverse()) fn();
});

function paidEventFixture(ownerId: string, title: string) {
	const event = createTestEvent(ownerId, {
		title,
		startDate: new Date(Date.now() + 7 * 86400000).toISOString(),
		endDate: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(),
	});
	const groupId = crypto.randomUUID();
	const productId = crypto.randomUUID();
	const sqlite = openDb();
	sqlite
		.prepare(
			"INSERT INTO inventory_groups (id, event_id, name, max_capacity, needs_ticket) VALUES (?, ?, ?, ?, ?)",
		)
		.run(groupId, event.eventId, "General", 100, 1);
	sqlite
		.prepare(
			"INSERT INTO products (id, event_id, inventory_group_id, name, price, max_quantity, participant_capacity, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		)
		.run(productId, event.eventId, groupId, "VIP Pass", 25, 10, 1, "[]");
	sqlite.close();
	cleanups.push(() => {
		const s = openDb();
		const id = event.eventId;
		s.prepare("DELETE FROM tickets WHERE event_id = ?").run(id);
		s.prepare(
			"DELETE FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE event_id = ?)",
		).run(id);
		s.prepare("DELETE FROM transactions WHERE event_id = ?").run(id);
		s.prepare("DELETE FROM products WHERE event_id = ?").run(id);
		s.prepare("DELETE FROM inventory_groups WHERE event_id = ?").run(id);
		s.close();
		event.cleanup();
	});
	return { eventId: event.eventId, productId };
}

describe("events notifications after a paid ticket", () => {
	it("queues the confirmation and the sales alert, and the worker sends both unchanged", async () => {
		const buyer = createTestUser({ name: "Ada" });
		cleanups.push(buyer.cleanup);
		const buyerEmail = `test-${buyer.userId}@example.com`;
		const title = `Notify Paid Event ${Date.now()}`;
		const { eventId, productId } = paidEventFixture(buyer.userId, title);

		const paymentIntent = {
			id: `pi_${crypto.randomUUID()}`,
			amount: 5000,
			metadata: {
				moduleId: "events",
				kind: "tickets",
				eventId,
				userId: buyer.userId,
				items: JSON.stringify([{ productId, quantity: 2 }]),
			},
		} as unknown as Stripe.PaymentIntent;
		await onTicketsPaid({
			paymentIntent,
			event: {} as Stripe.Event,
			idempotencyKey: paymentIntent.id,
		});

		const rows = await db.select().from(notificationOutbox);
		const confirmation = rows.find(
			(r) => r.notificationId === "events.ticket-confirmation",
		);
		const sale = rows.find((r) => r.notificationId === "events.sale");
		expect(rows).toHaveLength(2);
		expect(confirmation).toMatchObject({
			channel: "email",
			recipientUserId: buyer.userId,
			recipientAddress: buyerEmail,
			status: "pending",
			data: {
				eventId,
				products: [{ name: "VIP Pass", quantity: 2, amount: 25 }],
				totalAmount: 50,
			},
		});
		const ticketIds = (confirmation?.data as { ticketIds: string[] }).ticketIds;
		expect(ticketIds).toHaveLength(2);
		expect(sale).toMatchObject({
			channel: "telegram",
			recipientUserId: null,
			recipientAddress: process.env.TELEGRAM_CHANNEL_ID,
			data: { productName: "VIP Pass", quantity: 2, amount: 50 },
		});

		expect(await processOutboxOnce()).toEqual({
			sent: 2,
			retried: 0,
			failed: 0,
		});

		// Telegram text identical to the pre-outbox alert.
		const remaining = (sale?.data as { remaining: number }).remaining;
		expect(getTelegramMessages().map((m) => [m.chatId, m.text])).toEqual([
			[
				process.env.TELEGRAM_CHANNEL_ID,
				`🎫 New sale: 2x VIP Pass (€50.00)\n📊 Remaining: ${remaining} spots`,
			],
		]);

		// Email: subject, greeting, ticket QR links (current uuids, read at send time).
		const search = (await (
			await fetch(
				`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${buyerEmail}"`)}`,
			)
		).json()) as { messages: Array<{ ID: string }> };
		const message = (await (
			await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`)
		).json()) as {
			Subject: string;
			HTML: string;
			Text: string;
			Attachments: Array<{
				FileName: string;
				ContentType: string;
				PartID: string;
			}>;
		};
		expect(message.Subject).toBe(`Your tickets for ${title}`);
		expect(message.Text).toContain("Hello Ada!");
		expect(message.Text).toContain("Purchase Confirmed");

		// The calendar entry is attached, built at send time from the event.
		expect(message.Attachments.map((a) => a.FileName)).toEqual(["event.ics"]);
		expect(message.Attachments[0].ContentType).toContain("text/calendar");
		const ics = await (
			await fetch(
				`${mailpit}/api/v1/message/${search.messages[0].ID}/part/${message.Attachments[0].PartID}`,
			)
		).text();
		expect(ics).toContain("BEGIN:VEVENT");
		expect(ics).toContain(`SUMMARY:${title}`);
		expect(ics).toContain(`UID:event-${eventId}@`);
		const sqlite = openDb();
		const qr = sqlite
			.prepare("SELECT id, qr_code_uuid FROM tickets WHERE event_id = ?")
			.all(eventId) as Array<{ id: string; qr_code_uuid: string }>;
		sqlite.close();
		expect(qr.map((t) => t.id).sort()).toEqual([...ticketIds].sort());
		for (const t of qr) {
			expect(message.HTML).toContain(
				`/profile/tickets/${t.id}_${t.qr_code_uuid}`,
			);
		}
	}, 30_000);
});
