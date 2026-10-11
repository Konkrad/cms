import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	type NewNotificationOutboxRow,
	type NotificationOutboxRow,
	notificationOutbox,
} from "~/core/notifications/schema";

/** While a worker sends a claimed row, it is invisible to other ticks/processes this long. */
const CLAIM_LEASE_MS = 5 * 60 * 1000;

export const notificationOutboxService = {
	async insertMany(rows: NewNotificationOutboxRow[]): Promise<void> {
		if (rows.length === 0) return;
		await db.insert(notificationOutbox).values(rows);
	},

	/**
	 * Pending rows that are due, oldest first. Each is claimed by pushing `nextAttemptAt`
	 * past a lease, so a row is never sent twice concurrently even with two processes.
	 */
	async claimDue(now: Date, limit: number): Promise<NotificationOutboxRow[]> {
		const due = await db
			.select()
			.from(notificationOutbox)
			.where(
				and(
					eq(notificationOutbox.status, "pending"),
					lte(notificationOutbox.nextAttemptAt, now.toISOString()),
				),
			)
			.orderBy(asc(notificationOutbox.nextAttemptAt))
			.limit(limit);

		const lease = new Date(now.getTime() + CLAIM_LEASE_MS).toISOString();
		const claimed: NotificationOutboxRow[] = [];
		for (const row of due) {
			const updated = await db
				.update(notificationOutbox)
				.set({ nextAttemptAt: lease })
				.where(
					and(
						eq(notificationOutbox.id, row.id),
						eq(notificationOutbox.status, "pending"),
						eq(notificationOutbox.nextAttemptAt, row.nextAttemptAt),
					),
				)
				.returning({ id: notificationOutbox.id });
			if (updated.length === 1) claimed.push(row);
		}
		return claimed;
	},

	async markSent(id: string, attempts: number, now: Date): Promise<void> {
		await db
			.update(notificationOutbox)
			.set({
				status: "sent",
				attempts,
				lastError: null,
				sentAt: now.toISOString(),
			})
			.where(eq(notificationOutbox.id, id));
	},

	/** Failed attempt that will be retried at `nextAttemptAt`. */
	async markRetry(
		id: string,
		attempts: number,
		error: string,
		nextAttemptAt: Date,
	): Promise<void> {
		await db
			.update(notificationOutbox)
			.set({
				status: "pending",
				attempts,
				lastError: error,
				nextAttemptAt: nextAttemptAt.toISOString(),
			})
			.where(eq(notificationOutbox.id, id));
	},

	/** Gives up on a row: no further automatic attempts (an admin can re-queue it). */
	async markFailed(id: string, attempts: number, error: string): Promise<void> {
		await db
			.update(notificationOutbox)
			.set({ status: "failed", attempts, lastError: error })
			.where(eq(notificationOutbox.id, id));
	},
};
