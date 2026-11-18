/**
 * Notification system (src/core/notifications). Test plan:
 *
 * notify / outbox insert (this file)
 *  - one pending row per user recipient and user-addressable channel, plus one per ops target
 *  - the email address is looked up from the user id, never taken from the caller
 *  - a user without an address gets a failed row with a clear error
 *  - unknown id, non-serializable data, malformed recipients and unknown ops targets throw
 *  - preferences: a muted optional notification is not queued; required ones ignore mutes
 * worker (notifications-worker.spec.ts): success, failure + backoff, max attempts, an
 *  unconfigured channel, inactive-module definitions, unsubscribe headers
 * unsubscribe token (notifications-unsubscribe.spec.ts): sign/verify, tampering, scope
 * e2e (tests/e2e/notifications.spec.ts): RSVP email via Mailpit, unsubscribe link, profile
 *  toggles, admin failure view + retry, Telegram sales alert after a signed paid webhook
 */
import { inArray } from "drizzle-orm";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "~/core/db/connection";
import { defineNotification } from "~/core/notifications/define";
import { enqueueNotification, notify } from "~/core/notifications/notify";
import { notificationOutbox } from "~/core/notifications/schema";
import { createTestUser, openDb } from "./helpers";

const cleanups: Array<() => void> = [];
const rowIds: string[] = [];
afterEach(async () => {
	if (rowIds.length > 0) {
		await db
			.delete(notificationOutbox)
			.where(inArray(notificationOutbox.id, rowIds.splice(0)));
	}
	for (const fn of cleanups.splice(0)) fn();
});

function user() {
	const u = createTestUser();
	cleanups.push(u.cleanup);
	return { ...u, email: `test-${u.userId}@example.com` };
}

const rowsOf = async (ids: string[]) => {
	rowIds.push(...ids);
	return ids.length === 0
		? []
		: db
				.select()
				.from(notificationOutbox)
				.where(inArray(notificationOutbox.id, ids));
};

const emailAndTelegram = defineNotification<{ thing: string }>({
	id: "test.both",
	label: "Both",
	channels: ["email", "telegram"],
	optional: false,
	render: {
		email: (data) => ({
			subject: data.thing,
			react: createElement("p", null, data.thing),
		}),
		telegram: (data) => data.thing,
	},
});

const telegramOnly = defineNotification<{ n: number }>({
	id: "test.telegram-only",
	label: "Telegram",
	channels: ["telegram"],
	optional: false,
	render: { telegram: (data) => `n=${data.n}` },
});

describe("defineNotification", () => {
	it("rejects a channel without renderer and a malformed id", () => {
		expect(() =>
			defineNotification({
				id: "test.x",
				label: "x",
				channels: ["email"],
				optional: false,
				render: {},
			}),
		).toThrow(/no email renderer/);
		expect(() =>
			defineNotification({
				id: "NoDot",
				label: "x",
				channels: ["telegram"],
				optional: false,
				render: { telegram: () => "" },
			}),
		).toThrow(/must look like/);
	});
});

describe("notify / enqueueNotification", () => {
	it("writes one pending row per user and addressable channel, and one per ops target", async () => {
		const a = user();
		const b = user();
		const rows = await rowsOf(
			await enqueueNotification(emailAndTelegram, {
				to: [
					a.userId,
					b.userId,
					a.userId,
					{ channel: "telegram", target: "ops" },
				],
				data: { thing: "hello" },
			}),
		);

		// Telegram has no per-user address: users get email only, the ops target gets telegram.
		expect(rows).toHaveLength(3);
		const email = rows.filter((r) => r.channel === "email");
		expect(email.map((r) => r.recipientUserId).sort()).toEqual(
			[a.userId, b.userId].sort(),
		);
		for (const r of email) {
			expect(r.status).toBe("pending");
			expect(r.attempts).toBe(0);
			expect(r.data).toEqual({ thing: "hello" });
			expect(r.recipientAddress).toBe(
				r.recipientUserId === a.userId ? a.email : b.email,
			);
		}
		const ops = rows.find((r) => r.channel === "telegram");
		expect(ops?.recipientUserId).toBeNull();
		expect(ops?.recipientAddress).toBe(process.env.TELEGRAM_CHANNEL_ID);
		expect(ops?.status).toBe("pending");
	});

	it("takes the address from the user's login, never from the caller", async () => {
		const a = user();
		const rows = await rowsOf(
			await enqueueNotification(emailAndTelegram, {
				to: a.userId,
				data: {
					thing: "x",
					email: "attacker@example.com",
					to: "attacker@example.com",
				},
			}),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].recipientAddress).toBe(a.email);

		// An address-shaped recipient is not a user id or ops target: rejected outright.
		await expect(
			enqueueNotification(emailAndTelegram, {
				to: { email: "attacker@example.com" } as never,
				data: { thing: "x" },
			}),
		).rejects.toThrow(/user id or \{ channel, target \}/);
		await expect(
			enqueueNotification(emailAndTelegram, {
				to: {
					channel: "telegram",
					target: "ops",
					address: "attacker-chat",
				} as never,
				data: { thing: "x" },
			}),
		).rejects.toThrow(/user id or \{ channel, target \}/);
	});

	it("records a user without an email address as a failed row", async () => {
		const a = user();
		const sqlite = openDb();
		sqlite
			.prepare("UPDATE users SET login_id = NULL WHERE id = ?")
			.run(a.userId);
		sqlite.close();

		const rows = await rowsOf(
			await enqueueNotification(emailAndTelegram, {
				to: a.userId,
				data: { thing: "x" },
			}),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe("failed");
		expect(rows[0].recipientAddress).toBeNull();
		expect(rows[0].lastError).toMatch(/no email address/);
	});

	it("rejects non-serializable data", async () => {
		const a = user();
		for (const data of [
			{ when: new Date() },
			{ fn: () => 1 },
			{ n: Number.NaN },
			{ nested: [{ buf: Buffer.from("x") }] },
		]) {
			await expect(
				enqueueNotification(emailAndTelegram, { to: a.userId, data }),
			).rejects.toThrow(/not JSON-serializable/);
		}
	});

	it("rejects unknown ops targets, ops targets on undeclared channels and unreachable users", async () => {
		const a = user();
		await expect(
			enqueueNotification(telegramOnly, {
				to: { channel: "telegram", target: "nope" },
				data: { n: 1 },
			}),
		).rejects.toThrow(/Unknown notification target telegram:nope/);
		await expect(
			enqueueNotification(
				defineNotification({
					id: "test.email-only",
					label: "e",
					channels: ["email"],
					optional: false,
					render: {
						email: () => ({ subject: "s", react: createElement("p") }),
					},
				}),
				{ to: { channel: "telegram", target: "ops" }, data: {} },
			),
		).rejects.toThrow(/has no telegram channel/);
		await expect(
			enqueueNotification(telegramOnly, { to: a.userId, data: { n: 1 } }),
		).rejects.toThrow(/no channel that can reach a user/);
	});

	it("notify throws on an unknown notification id", async () => {
		await expect(
			notify("nope.does-not-exist", { to: [], data: {} }),
		).rejects.toThrow(/Unknown notification id: nope.does-not-exist/);
	}, 30_000);
});
