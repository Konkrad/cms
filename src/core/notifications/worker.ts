import { channels as defaultChannels } from "~/core/notifications/channels";
import type { ChannelRegistry } from "~/core/notifications/channels/define";
import type {
	ChannelId,
	NotificationDefinition,
	RenderContext,
} from "~/core/notifications/define";
import { notificationOutboxService } from "~/core/notifications/outbox.service";
import type { NotificationOutboxRow } from "~/core/notifications/schema";
import { usersService } from "~/core/users/users.service";
import { env } from "~/env";

/**
 * Outbox worker: renders and sends due `pending` rows through their channel adapter, then
 * marks them `sent`, re-schedules them with exponential backoff, or marks them `failed` once
 * `NOTIFICATIONS_MAX_ATTEMPTS` is reached. Runs in the server process (see `startOutboxWorker`).
 */

const BATCH_SIZE = 10;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 1000;

/** Delay before the next attempt after `attempts` failed ones: 30s, 1m, 2m, 4m ... capped at 1h. */
export const backoffMs = (attempts: number): number =>
	Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1), BACKOFF_MAX_MS);

export interface ProcessOutboxOptions {
	now?: Date;
	batchSize?: number;
	maxAttempts?: number;
	/** Definition lookup; defaults to the registry of ALL registered modules plus core. */
	resolve?: (id: string) => NotificationDefinition | undefined;
	channels?: ChannelRegistry;
}

export interface ProcessOutboxResult {
	sent: number;
	retried: number;
	failed: number;
}

/** One worker tick: claims up to `batchSize` due rows and processes them in order. */
export async function processOutboxOnce(
	options: ProcessOutboxOptions = {},
): Promise<ProcessOutboxResult> {
	const now = options.now ?? new Date();
	const maxAttempts = options.maxAttempts ?? env.NOTIFICATIONS_MAX_ATTEMPTS;
	const channels = options.channels ?? defaultChannels;
	const resolve =
		options.resolve ??
		// Lazy: the registry imports every module manifest.
		(await import("~/core/registry/notifications")).getNotificationDefinition;

	const result: ProcessOutboxResult = { sent: 0, retried: 0, failed: 0 };
	const rows = await notificationOutboxService.claimDue(
		now,
		options.batchSize ?? BATCH_SIZE,
	);
	for (const row of rows) {
		const outcome = await processRow(row, {
			now,
			maxAttempts,
			channels,
			resolve,
		});
		result[outcome]++;
	}
	return result;
}

async function processRow(
	row: NotificationOutboxRow,
	{
		now,
		maxAttempts,
		channels,
		resolve,
	}: Required<Omit<ProcessOutboxOptions, "batchSize">>,
): Promise<keyof ProcessOutboxResult> {
	// Permanent problems: no retry, the row goes straight to the admin failure view.
	const giveUp = async (error: string) => {
		await notificationOutboxService.markFailed(row.id, row.attempts, error);
		return "failed" as const;
	};

	const def = resolve(row.notificationId);
	if (!def) return giveUp(`Unknown notification id: ${row.notificationId}`);
	const channelId = row.channel as ChannelId;
	const channel = channels[channelId];
	const renderer = def.render[channelId];
	if (!channel || !renderer || !def.channels.includes(channelId)) {
		return giveUp(`Notification ${def.id} has no ${row.channel} channel`);
	}
	// Disabled/unconfigured channel: fail explicitly (an admin re-queues once configured).
	const unavailable = channel.unavailableReason();
	if (unavailable) {
		return giveUp(`Channel ${channelId} is unavailable: ${unavailable}`);
	}
	if (!row.recipientAddress) return giveUp("Row has no recipient address");

	const attempts = row.attempts + 1;
	try {
		const recipient = row.recipientUserId
			? await usersService.getPublicProfile(row.recipientUserId)
			: undefined;
		const ctx: RenderContext = {
			recipient: {
				userId: row.recipientUserId,
				name: recipient?.name ?? null,
				address: row.recipientAddress,
			},
			appUrl: env.APP_URL,
			unsubscribeUrl: null,
		};
		const content = await renderer(row.data as never, ctx);
		await channel.send({
			to: row.recipientAddress,
			content: content as never,
			unsubscribeUrl: ctx.unsubscribeUrl,
		});
	} catch (error) {
		// Any render/transport error is a failed attempt; it never escapes the tick.
		const message = (
			error instanceof Error ? error.message : String(error)
		).slice(0, MAX_ERROR_LENGTH);
		if (attempts >= maxAttempts) {
			await notificationOutboxService.markFailed(row.id, attempts, message);
			return "failed";
		}
		await notificationOutboxService.markRetry(
			row.id,
			attempts,
			message,
			new Date(now.getTime() + backoffMs(attempts)),
		);
		return "retried";
	}
	await notificationOutboxService.markSent(row.id, attempts, now);
	return "sent";
}

const WORKER_KEY = Symbol.for("cms.notifications.outboxWorker");

/**
 * Starts the polling loop once per process (a `globalThis` guard makes repeated calls, e.g. a
 * dev-server restart, no-ops). A tick is skipped while the previous one still runs, so ticks
 * never overlap. Not started under NODE_ENV=test (unit tests call `processOutboxOnce`).
 */
export function startOutboxWorker(
	intervalMs: number = env.NOTIFICATIONS_POLL_INTERVAL_MS,
): void {
	if (env.NODE_ENV === "test") return;
	const store = globalThis as { [WORKER_KEY]?: ReturnType<typeof setInterval> };
	if (store[WORKER_KEY]) return;

	let running = false;
	const timer = setInterval(async () => {
		if (running) return;
		running = true;
		try {
			await processOutboxOnce();
		} catch (error) {
			// A broken tick (e.g. the DB is locked) must not crash the server; the next one retries.
			console.error("Notification outbox tick failed:", error);
		} finally {
			running = false;
		}
	}, intervalMs);
	timer.unref();
	store[WORKER_KEY] = timer;
}
