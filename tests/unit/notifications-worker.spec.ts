/** Outbox worker (src/core/notifications/worker.ts); test plan in notifications.spec.ts. */
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/core/db/connection";
import type {
	ChannelMessage,
	ChannelRegistry,
} from "~/core/notifications/channels/define";
import {
	defineNotification,
	type RenderContext,
} from "~/core/notifications/define";
import { enqueueNotification } from "~/core/notifications/notify";
import { notificationOutboxService } from "~/core/notifications/outbox.service";
import { notificationOutbox } from "~/core/notifications/schema";
import {
	backoffMs,
	processOutboxOnce,
	startOutboxWorker,
} from "~/core/notifications/worker";
import { buildNotificationRegistry } from "~/core/registry/notifications";
import { defineModule, selectActive } from "~/core/router/modules";
import { createTestUser } from "./helpers";

const cleanups: Array<() => void> = [];
beforeEach(async () => {
	// The worker claims every due row in the DB; start each test from an empty outbox.
	await db.delete(notificationOutbox);
});
afterEach(async () => {
	await db.delete(notificationOutbox);
	for (const fn of cleanups.splice(0)) fn();
});

function user(name = "Ada") {
	const u = createTestUser({ name });
	cleanups.push(u.cleanup);
	return { ...u, email: `test-${u.userId}@example.com` };
}

const rendered: Array<{ data: unknown; ctx: RenderContext }> = [];
const greeting = defineNotification<{ text: string }>({
	id: "test.greeting",
	label: "Greeting",
	channels: ["email"],
	optional: false,
	render: {
		email: (data, ctx) => {
			rendered.push({ data, ctx });
			return {
				subject: `Hi ${ctx.recipient.name}`,
				react: createElement("p", null, data.text),
			};
		},
	},
});
const salesAlert = defineNotification<{ text: string }>({
	id: "test.sales",
	label: "Sales",
	channels: ["telegram"],
	optional: false,
	render: { telegram: (data) => data.text },
});
const definitions = new Map([
	[greeting.id, greeting],
	[salesAlert.id, salesAlert],
]);

function fakeChannels(opts: { emailFails?: boolean } = {}) {
	const emails: ChannelMessage<"email">[] = [];
	const telegramSend = vi.fn(async () => {});
	const channels: ChannelRegistry = {
		email: {
			id: "email",
			unavailableReason: () => null,
			async send(message) {
				if (opts.emailFails) throw new Error("SMTP connection refused");
				emails.push(message);
			},
		},
		telegram: {
			id: "telegram",
			unavailableReason: () => "TELEGRAM_BOT_TOKEN is not set",
			send: telegramSend,
		},
	};
	return { channels, emails, telegramSend };
}

const getRow = async (id: string) =>
	(
		await db
			.select()
			.from(notificationOutbox)
			.where(eq(notificationOutbox.id, id))
	)[0];

const T0 = new Date("2030-01-01T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("processOutboxOnce", () => {
	it("renders with the stored data and recipient, sends, and marks the row sent", async () => {
		const u = user("Grace");
		const [id] = await enqueueNotification(
			greeting,
			{ to: u.userId, data: { text: "welcome" } },
			T0,
		);
		const { channels, emails } = fakeChannels();

		const result = await processOutboxOnce({
			now: at(1000),
			channels,
			resolve: (nid) => definitions.get(nid),
		});

		expect(result).toEqual({ sent: 1, retried: 0, failed: 0 });
		expect(emails).toHaveLength(1);
		expect(emails[0].to).toBe(u.email);
		expect(emails[0].content.subject).toBe("Hi Grace");
		expect(emails[0].unsubscribeUrl).toBeNull();
		expect(rendered.at(-1)?.data).toEqual({ text: "welcome" });
		expect(rendered.at(-1)?.ctx.recipient).toEqual({
			userId: u.userId,
			name: "Grace",
			address: u.email,
		});

		const row = await getRow(id);
		expect(row.status).toBe("sent");
		expect(row.attempts).toBe(1);
		expect(row.lastError).toBeNull();
		expect(row.sentAt).toBe(at(1000).toISOString());

		// A sent row is never picked up again.
		expect(
			await processOutboxOnce({
				now: at(10 * 60 * 60 * 1000),
				channels,
				resolve: (nid) => definitions.get(nid),
			}),
		).toEqual({ sent: 0, retried: 0, failed: 0 });
	});

	it("retries a failed send with exponential backoff, then gives up after max attempts", async () => {
		const u = user();
		const [id] = await enqueueNotification(
			greeting,
			{ to: u.userId, data: { text: "x" } },
			T0,
		);
		const { channels } = fakeChannels({ emailFails: true });
		const run = (now: Date) =>
			processOutboxOnce({
				now,
				channels,
				maxAttempts: 3,
				resolve: (nid) => definitions.get(nid),
			});

		expect(await run(T0)).toEqual({ sent: 0, retried: 1, failed: 0 });
		let row = await getRow(id);
		expect(row.status).toBe("pending");
		expect(row.attempts).toBe(1);
		expect(row.lastError).toBe("SMTP connection refused");
		expect(row.nextAttemptAt).toBe(at(backoffMs(1)).toISOString());
		expect(backoffMs(1)).toBe(30_000);
		expect(backoffMs(2)).toBe(60_000);
		expect(backoffMs(20)).toBe(60 * 60 * 1000);

		// Not due yet: untouched.
		expect(await run(at(backoffMs(1) - 1))).toEqual({
			sent: 0,
			retried: 0,
			failed: 0,
		});

		const second = at(backoffMs(1));
		expect(await run(second)).toEqual({ sent: 0, retried: 1, failed: 0 });
		row = await getRow(id);
		expect(row.attempts).toBe(2);
		expect(row.nextAttemptAt).toBe(
			new Date(second.getTime() + backoffMs(2)).toISOString(),
		);

		expect(await run(new Date(second.getTime() + backoffMs(2)))).toEqual({
			sent: 0,
			retried: 0,
			failed: 1,
		});
		row = await getRow(id);
		expect(row.status).toBe("failed");
		expect(row.attempts).toBe(3);
		expect(row.lastError).toBe("SMTP connection refused");

		// Failed rows are not retried automatically.
		expect(await run(at(24 * 60 * 60 * 1000))).toEqual({
			sent: 0,
			retried: 0,
			failed: 0,
		});
	});

	it("marks rows of an unconfigured channel failed with a clear error, without sending", async () => {
		const [id] = await enqueueNotification(
			salesAlert,
			{ to: { channel: "telegram", target: "ops" }, data: { text: "sale" } },
			T0,
		);
		const { channels, telegramSend } = fakeChannels();

		expect(
			await processOutboxOnce({
				now: T0,
				channels,
				resolve: (nid) => definitions.get(nid),
			}),
		).toEqual({ sent: 0, retried: 0, failed: 1 });
		expect(telegramSend).not.toHaveBeenCalled();
		const row = await getRow(id);
		expect(row.status).toBe("failed");
		expect(row.attempts).toBe(0);
		expect(row.lastError).toBe(
			"Channel telegram is unavailable: TELEGRAM_BOT_TOKEN is not set",
		);
	});

	it("fails a row whose notification id no longer exists", async () => {
		const u = user();
		const [id] = await enqueueNotification(
			greeting,
			{ to: u.userId, data: { text: "x" } },
			T0,
		);
		const { channels } = fakeChannels();
		await processOutboxOnce({ now: T0, channels, resolve: () => undefined });
		const row = await getRow(id);
		expect(row.status).toBe("failed");
		expect(row.lastError).toBe("Unknown notification id: test.greeting");
	});

	it("processes at most batchSize rows per tick", async () => {
		const u = user();
		for (let i = 0; i < 3; i++) {
			await enqueueNotification(
				greeting,
				{ to: u.userId, data: { text: String(i) } },
				at(i),
			);
		}
		const { channels, emails } = fakeChannels();
		const run = () =>
			processOutboxOnce({
				now: at(1000),
				batchSize: 2,
				channels,
				resolve: (nid) => definitions.get(nid),
			});
		expect((await run()).sent).toBe(2);
		expect((await run()).sent).toBe(1);
		// Oldest first.
		expect(emails.map((m) => m.content.subject)).toHaveLength(3);
	});
});

describe("admin failure view service", () => {
	it("lists failed and pending rows (not sent ones) and re-queues a failed row", async () => {
		const u = user();
		const [failedId] = await enqueueNotification(
			greeting,
			{ to: u.userId, data: { text: "f" } },
			T0,
		);
		const [pendingId, sentId] = await Promise.all([
			enqueueNotification(greeting, { to: u.userId, data: { text: "p" } }, T0),
			enqueueNotification(greeting, { to: u.userId, data: { text: "s" } }, T0),
		]).then((ids) => ids.flat());
		await notificationOutboxService.markFailed(failedId, 5, "boom");
		await notificationOutboxService.markSent(sentId, 1, T0);

		const listed = await notificationOutboxService.listUndeliveredWithAddress();
		expect(listed.map((r) => r.id).sort()).toEqual(
			[failedId, pendingId].sort(),
		);
		expect(listed.find((r) => r.id === failedId)).toMatchObject({
			status: "failed",
			attempts: 5,
			lastError: "boom",
			recipientAddress: u.email,
		});
		expect(listed[0]).not.toHaveProperty("data");

		expect(await notificationOutboxService.requeue(failedId, at(5))).toBe(true);
		expect(await getRow(failedId)).toMatchObject({
			status: "pending",
			attempts: 0,
			nextAttemptAt: at(5).toISOString(),
		});
		expect(await notificationOutboxService.requeue(sentId, at(5))).toBe(false);
		expect(await notificationOutboxService.requeue("missing", at(5))).toBe(
			false,
		);
	});
});

describe("definitions of inactive modules", () => {
	it("are resolved, so their queued rows are still sent", async () => {
		const fromInactive = defineNotification<{ text: string }>({
			id: "dormant.reminder",
			label: "Reminder",
			channels: ["email"],
			optional: false,
			render: {
				email: (data) => ({
					subject: data.text,
					react: createElement("p", null, data.text),
				}),
			},
		});
		const all = [
			defineModule({ id: "live", notifications: [greeting] }),
			defineModule({ id: "dormant", notifications: [fromInactive] }),
		];
		expect(selectActive(all, ["live"]).map((m) => m.id)).toEqual(["live"]);
		const registry = buildNotificationRegistry([], all);
		expect(registry.get("dormant.reminder")).toBe(fromInactive);

		const u = user();
		const [id] = await enqueueNotification(
			fromInactive,
			{ to: u.userId, data: { text: "still here" } },
			T0,
		);
		const { channels, emails } = fakeChannels();
		await processOutboxOnce({
			now: T0,
			channels,
			resolve: (nid) => registry.get(nid),
		});
		expect(emails[0]?.content.subject).toBe("still here");
		expect((await getRow(id)).status).toBe("sent");
	});

	it("rejects duplicate notification ids across modules", () => {
		expect(() =>
			buildNotificationRegistry(
				[greeting],
				[defineModule({ id: "m", notifications: [greeting] })],
			),
		).toThrow(/Duplicate notification id: test.greeting/);
	});
});

describe("startOutboxWorker", () => {
	it("never starts under NODE_ENV=test", () => {
		startOutboxWorker(10);
		expect(
			(globalThis as Record<symbol, unknown>)[
				Symbol.for("cms.notifications.outboxWorker")
			],
		).toBeUndefined();
	});
});
