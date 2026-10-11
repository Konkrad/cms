import { randomUUID } from "node:crypto";
import {
	resolveOpsTarget,
	resolveUserAddresses,
} from "~/core/notifications/addressing";
import type {
	ChannelId,
	NotificationDefinition,
} from "~/core/notifications/define";
import { notificationOutboxService } from "~/core/notifications/outbox.service";
import type { NewNotificationOutboxRow } from "~/core/notifications/schema";

/** A message for the team rather than a user, e.g. `{ channel: "telegram", target: "ops" }`. */
export interface OpsTarget {
	channel: ChannelId;
	target: string;
}

/** A user id, or an ops target. Addresses are never passed in; they are resolved server-side. */
export type NotifyRecipient = string | OpsTarget;

export interface NotifyInput {
	to: NotifyRecipient | readonly NotifyRecipient[];
	/** JSON-serializable payload for the renderers (prefer ids; render loads the rest). */
	data: Record<string, unknown>;
}

/**
 * Queues a notification: one `notification_outbox` row per recipient and channel, status
 * `pending`. Nothing is sent inline; the outbox worker renders and sends. Server-only.
 * Throws on an unknown id, non-serializable data or an unknown ops target.
 * Returns the ids of the rows written.
 */
export async function notify(
	id: string,
	input: NotifyInput,
): Promise<string[]> {
	// Lazy: the registry imports every module manifest, which import this file via ~/core.
	const { getNotificationDefinition } = await import(
		"~/core/registry/notifications"
	);
	const def = getNotificationDefinition(id);
	if (!def) throw new Error(`Unknown notification id: ${id}`);
	return enqueueNotification(def, input);
}

/** `notify` for a resolved definition (tests pass fake definitions here). */
export async function enqueueNotification(
	def: NotificationDefinition,
	input: NotifyInput,
	now: Date = new Date(),
): Promise<string[]> {
	assertSerializable(input.data, "data");
	const data = JSON.parse(JSON.stringify(input.data)) as Record<
		string,
		unknown
	>;
	const recipients = Array.isArray(input.to) ? input.to : [input.to];

	const userIds: string[] = [];
	const opsTargets: OpsTarget[] = [];
	for (const recipient of recipients as NotifyRecipient[]) {
		if (typeof recipient === "string") {
			if (!userIds.includes(recipient)) userIds.push(recipient);
		} else if (isOpsTarget(recipient)) {
			if (!def.channels.includes(recipient.channel)) {
				throw new Error(
					`Notification ${def.id} has no ${recipient.channel} channel`,
				);
			}
			opsTargets.push(recipient);
		} else {
			throw new Error(
				`Notification ${def.id}: a recipient must be a user id or { channel, target }`,
			);
		}
	}

	const createdAt = now.toISOString();
	const row = (
		channel: ChannelId,
		recipient: { userId: string | null; address: string | null },
		error?: string,
	): NewNotificationOutboxRow => ({
		id: randomUUID(),
		notificationId: def.id,
		channel,
		recipientUserId: recipient.userId,
		recipientAddress: recipient.address,
		data,
		// A recipient without an address is recorded as failed right away, so it shows up in
		// the admin failure view instead of disappearing silently.
		status: error ? "failed" : "pending",
		lastError: error ?? null,
		attempts: 0,
		nextAttemptAt: createdAt,
		createdAt,
	});

	const rows: NewNotificationOutboxRow[] = [];
	let reachesUsers = false;
	for (const channel of def.channels) {
		if (userIds.length === 0) continue;
		const addresses = await resolveUserAddresses(channel, userIds);
		// The channel has no per-user address (e.g. telegram): users get it on the others.
		if (!addresses) continue;
		reachesUsers = true;
		for (const userId of userIds) {
			const address = addresses.get(userId) ?? null;
			rows.push(
				row(
					channel,
					{ userId, address },
					address ? undefined : `User has no ${channel} address`,
				),
			);
		}
	}
	if (userIds.length > 0 && !reachesUsers) {
		throw new Error(
			`Notification ${def.id} has no channel that can reach a user (${def.channels.join(", ")})`,
		);
	}
	for (const target of opsTargets) {
		const resolved = resolveOpsTarget(target.channel, target.target);
		rows.push(
			"address" in resolved
				? row(target.channel, { userId: null, address: resolved.address })
				: row(target.channel, { userId: null, address: null }, resolved.error),
		);
	}

	await notificationOutboxService.insertMany(rows);
	return rows.map((r) => r.id);
}

function isOpsTarget(value: unknown): value is OpsTarget {
	if (!value || typeof value !== "object") return false;
	const keys = Object.keys(value).sort().join(",");
	const { channel, target } = value as Record<string, unknown>;
	return (
		keys === "channel,target" &&
		typeof channel === "string" &&
		typeof target === "string"
	);
}

/** Throws unless `value` survives a JSON round trip unchanged (undefined properties aside). */
function assertSerializable(value: unknown, path: string): void {
	if (value === null || typeof value === "string" || typeof value === "boolean")
		return;
	if (typeof value === "number") {
		if (Number.isFinite(value)) return;
	} else if (Array.isArray(value)) {
		value.forEach((item, i) => {
			assertSerializable(item, `${path}[${i}]`);
		});
		return;
	} else if (typeof value === "object") {
		const proto = Object.getPrototypeOf(value);
		if (proto === Object.prototype || proto === null) {
			for (const [key, item] of Object.entries(value)) {
				if (item !== undefined) assertSerializable(item, `${path}.${key}`);
			}
			return;
		}
	}
	throw new Error(`notify: ${path} is not JSON-serializable`);
}
