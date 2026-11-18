/**
 * Preferences, unsubscribe tokens and the unsubscribe endpoint; plus the email channel's
 * List-Unsubscribe headers and attachments against the Mailpit container.
 * Test plan in notifications.spec.ts.
 */
import { eq, inArray } from "drizzle-orm";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "~/core/db/connection";
import { emailChannel } from "~/core/notifications/channels/email";
import { defineNotification } from "~/core/notifications/define";
import { enqueueNotification } from "~/core/notifications/notify";
import {
	listNotificationSettings,
	setNotificationPreference,
} from "~/core/notifications/preferences";
import {
	notificationOutbox,
	notificationPreferences,
} from "~/core/notifications/schema";
import {
	signUnsubscribeToken,
	unsubscribeUrl,
	verifyUnsubscribeToken,
} from "~/core/notifications/unsubscribe-token";
import { processOutboxOnce } from "~/core/notifications/worker";
import { onGet, onPost } from "~/routes/api/notifications/unsubscribe";
import { createTestUser } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(async () => {
	await db.delete(notificationOutbox);
	for (const fn of cleanups.splice(0)) fn();
});

beforeAll(async () => {
	// Warm the module registry (imports every manifest) outside the per-test timeout.
	await import("~/core/registry/notifications");
}, 60_000);

function user(name = "Ada") {
	const u = createTestUser({ name });
	cleanups.push(u.cleanup);
	return { ...u, email: `test-${u.userId}@example.com` };
}

const preferencesOf = (userId: string) =>
	db
		.select()
		.from(notificationPreferences)
		.where(eq(notificationPreferences.userId, userId));

const optionalDigest = defineNotification<{ n: number }>({
	id: "test.digest",
	label: "Digest",
	channels: ["email"],
	optional: true,
	render: {
		email: (data) => ({
			subject: `digest ${data.n}`,
			react: createElement("p", null, "digest"),
		}),
	},
});
const requiredReceipt = defineNotification<{ n: number }>({
	id: "test.receipt",
	label: "Receipt",
	channels: ["email"],
	optional: false,
	render: {
		email: () => ({ subject: "receipt", react: createElement("p") }),
	},
});

describe("preferences in notify", () => {
	it("skips users who muted an optional notification and keeps the others", async () => {
		const muted = user();
		const other = user();
		await db.insert(notificationPreferences).values({
			userId: muted.userId,
			notificationId: "test.digest",
			channel: "email",
			enabled: false,
			updatedAt: new Date().toISOString(),
		});

		const ids = await enqueueNotification(optionalDigest, {
			to: [muted.userId, other.userId],
			data: { n: 1 },
		});
		const rows = await db
			.select()
			.from(notificationOutbox)
			.where(inArray(notificationOutbox.id, ids));
		expect(rows.map((r) => r.recipientUserId)).toEqual([other.userId]);
	});

	it("ignores preferences for required notifications", async () => {
		const u = user();
		await db.insert(notificationPreferences).values({
			userId: u.userId,
			notificationId: "test.receipt",
			channel: "email",
			enabled: false,
			updatedAt: new Date().toISOString(),
		});
		const ids = await enqueueNotification(requiredReceipt, {
			to: u.userId,
			data: { n: 1 },
		});
		expect(ids).toHaveLength(1);
	});

	it("only lets optional notifications on a declared channel be muted", async () => {
		const u = user();
		await setNotificationPreference(u.userId, "jobs.approved", "email", false);
		expect(await preferencesOf(u.userId)).toMatchObject([
			{ notificationId: "jobs.approved", channel: "email", enabled: false },
		]);
		await expect(
			setNotificationPreference(u.userId, "jobs.approved", "telegram", false),
		).rejects.toThrow(/cannot be muted/);
		await expect(
			setNotificationPreference(u.userId, "nope.unknown", "email", false),
		).rejects.toThrow(/cannot be muted/);

		const settings = await listNotificationSettings(u.userId);
		expect(settings).toContainEqual(
			expect.objectContaining({
				notificationId: "jobs.approved",
				channel: "email",
				enabled: false,
			}),
		);
		expect(settings.every((s) => s.notificationId !== "test.receipt")).toBe(
			true,
		);
	});
});

describe("unsubscribe token", () => {
	const scope = {
		userId: "user-a",
		notificationId: "jobs.approved",
		channel: "email",
	};

	it("verifies to exactly the scope it was signed for", () => {
		const token = signUnsubscribeToken(scope);
		expect(verifyUnsubscribeToken(token)).toEqual(scope);
		expect(unsubscribeUrl(scope)).toBe(
			`${process.env.APP_URL}/api/notifications/unsubscribe?token=${token}`,
		);
	});

	it("rejects tampered tokens", () => {
		const token = signUnsubscribeToken(scope);
		const [, signature] = token.split(".");
		for (const other of [
			{ ...scope, userId: "user-b" },
			{ ...scope, notificationId: "events.ticket-confirmation" },
			{ ...scope, channel: "telegram" },
		]) {
			const forgedPayload = Buffer.from(
				JSON.stringify([other.userId, other.notificationId, other.channel]),
			).toString("base64url");
			expect(
				verifyUnsubscribeToken(`${forgedPayload}.${signature}`),
			).toBeNull();
			// Each scope has its own signature.
			expect(signUnsubscribeToken(other).split(".")[1]).not.toBe(signature);
		}
		const flipped = `${signature.slice(0, -2)}${signature.endsWith("AA") ? "BB" : "AA"}`;
		expect(
			verifyUnsubscribeToken(`${token.split(".")[0]}.${flipped}`),
		).toBeNull();
		expect(verifyUnsubscribeToken("")).toBeNull();
		expect(verifyUnsubscribeToken("abc")).toBeNull();
		expect(verifyUnsubscribeToken(`${token}.extra`)).toBeNull();
	});
});

describe("unsubscribe endpoint", () => {
	function fakeEvent(token: string) {
		const html = vi.fn();
		return {
			html,
			event: {
				query: new URLSearchParams({ token }),
				html,
				error: (status: number, message: string) =>
					Object.assign(new Error(message), { status }),
			},
		};
	}
	const call = (handler: typeof onPost, token: string) => {
		const { event, html } = fakeEvent(token);
		return {
			html,
			done: (handler as (e: unknown) => Promise<void>)(event),
		};
	};

	it("GET only confirms; POST mutes exactly the signed user, notification and channel", async () => {
		const a = user();
		const b = user();
		const token = signUnsubscribeToken({
			userId: a.userId,
			notificationId: "jobs.approved",
			channel: "email",
		});

		const get = call(onGet, token);
		await get.done;
		expect(get.html).toHaveBeenCalledWith(
			200,
			expect.stringContaining('<form method="post"'),
		);
		expect(await preferencesOf(a.userId)).toEqual([]);

		const post = call(onPost, token);
		await post.done;
		expect(post.html).toHaveBeenCalledWith(
			200,
			expect.stringContaining("no longer receive"),
		);
		expect(await preferencesOf(a.userId)).toMatchObject([
			{ notificationId: "jobs.approved", channel: "email", enabled: false },
		]);
		expect(await preferencesOf(b.userId)).toEqual([]);
	});

	it("rejects invalid tokens and tokens for required notifications or undeclared channels", async () => {
		const a = user();
		for (const token of [
			"garbage",
			signUnsubscribeToken({
				userId: a.userId,
				notificationId: "events.ticket-confirmation",
				channel: "email",
			}),
			signUnsubscribeToken({
				userId: a.userId,
				notificationId: "jobs.approved",
				channel: "telegram",
			}),
		]) {
			await expect(call(onPost, token).done).rejects.toMatchObject({
				status: 400,
			});
		}
		expect(await preferencesOf(a.userId)).toEqual([]);
	});
});

describe("email channel", () => {
	const mailpit = process.env.MAILPIT_API_URL ?? "http://localhost:8025";

	async function findMessage(to: string) {
		for (let i = 0; i < 40; i++) {
			const res = await fetch(
				`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
			);
			const data = (await res.json()) as { messages?: Array<{ ID: string }> };
			if (data.messages?.[0]) return data.messages[0].ID;
			await new Promise((r) => setTimeout(r, 250));
		}
		throw new Error(`no email for ${to}`);
	}

	it("sends optional notifications with List-Unsubscribe headers and the footer link", async () => {
		const u = user("Linus");
		await enqueueNotification(
			(await import("~/core/registry/notifications")).getNotificationDefinition(
				"jobs.approved",
			) as typeof optionalDigest,
			{ to: u.userId, data: { jobId: "job-1", jobTitle: "Rust Engineer" } },
		);
		expect((await processOutboxOnce()).sent).toBe(1);

		const id = await findMessage(u.email);
		const headers = (await (
			await fetch(`${mailpit}/api/v1/message/${id}/headers`)
		).json()) as Record<string, string[]>;
		const expected = unsubscribeUrl({
			userId: u.userId,
			notificationId: "jobs.approved",
			channel: "email",
		});
		expect(headers["List-Unsubscribe"]).toEqual([`<${expected}>`]);
		expect(headers["List-Unsubscribe-Post"]).toEqual([
			"List-Unsubscribe=One-Click",
		]);
		const message = (await (
			await fetch(`${mailpit}/api/v1/message/${id}`)
		).json()) as { Subject: string; HTML: string; Text: string };
		expect(message.Subject).toBe('Your job "Rust Engineer" is live');
		expect(message.Text).toContain("Hello Linus!");
		expect(message.HTML).toContain(expected.replaceAll("&", "&amp;"));
	});

	it("keeps attachments and adds no unsubscribe headers to required mail", async () => {
		const to = `attach-${Date.now()}@example.com`;
		await emailChannel.send({
			to,
			unsubscribeUrl: null,
			content: {
				subject: "with attachment",
				react: createElement("p", null, "see attached"),
				attachments: [
					{
						filename: "event.ics",
						content: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
						contentType: "text/calendar",
					},
				],
			},
		});
		const id = await findMessage(to);
		const message = (await (
			await fetch(`${mailpit}/api/v1/message/${id}`)
		).json()) as { Attachments: Array<{ FileName: string }> };
		expect(message.Attachments.map((a) => a.FileName)).toEqual(["event.ics"]);
		const headers = (await (
			await fetch(`${mailpit}/api/v1/message/${id}/headers`)
		).json()) as Record<string, string[]>;
		expect(headers["List-Unsubscribe"]).toBeUndefined();
	});
});
