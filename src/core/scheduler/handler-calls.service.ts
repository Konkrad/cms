import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { type HandlerCall, handlerCalls } from "~/core/scheduler/schema";

/** While a process runs a claimed call, other ticks leave it alone this long. */
const CLAIM_LEASE_MS = 5 * 60 * 1000;

export interface NewHandlerCall {
	dedupeKey: string;
	owner: string;
	kind: string;
	type: string;
	hook: string;
	payload: Record<string, unknown>;
}

export const handlerCallsService = {
	/** Queues a call, due now; a second call with the same `dedupeKey` is ignored. */
	async enqueue(call: NewHandlerCall, now: Date = new Date()): Promise<void> {
		const iso = now.toISOString();
		await db
			.insert(handlerCalls)
			.values({
				id: crypto.randomUUID(),
				...call,
				nextAttemptAt: iso,
				createdAt: iso,
			})
			.onConflictDoNothing();
	},

	/** Due pending calls, oldest first, each claimed with a lease (no double runs). */
	async claimDue(now: Date, limit: number): Promise<HandlerCall[]> {
		const due = await db
			.select()
			.from(handlerCalls)
			.where(
				and(
					eq(handlerCalls.status, "pending"),
					lte(handlerCalls.nextAttemptAt, now.toISOString()),
				),
			)
			.orderBy(asc(handlerCalls.nextAttemptAt))
			.limit(limit);
		const lease = new Date(now.getTime() + CLAIM_LEASE_MS).toISOString();
		const claimed: HandlerCall[] = [];
		for (const row of due) {
			const updated = await db
				.update(handlerCalls)
				.set({ nextAttemptAt: lease })
				.where(
					and(
						eq(handlerCalls.id, row.id),
						eq(handlerCalls.status, "pending"),
						eq(handlerCalls.nextAttemptAt, row.nextAttemptAt),
					),
				)
				.returning({ id: handlerCalls.id });
			if (updated.length === 1) claimed.push(row);
		}
		return claimed;
	},

	async markDone(id: string, attempts: number, now: Date): Promise<void> {
		await db
			.update(handlerCalls)
			.set({
				status: "done",
				attempts,
				lastError: null,
				doneAt: now.toISOString(),
			})
			.where(eq(handlerCalls.id, id));
	},

	async markRetry(
		id: string,
		attempts: number,
		error: string,
		nextAttemptAt: Date,
	): Promise<void> {
		await db
			.update(handlerCalls)
			.set({
				attempts,
				lastError: error,
				nextAttemptAt: nextAttemptAt.toISOString(),
			})
			.where(eq(handlerCalls.id, id));
	},

	/** Pending calls that failed at least once (the admin failure view), newest first. */
	async listFailing(limit = 200): Promise<HandlerCall[]> {
		return db
			.select()
			.from(handlerCalls)
			.where(
				and(eq(handlerCalls.status, "pending"), gt(handlerCalls.attempts, 0)),
			)
			.orderBy(desc(handlerCalls.createdAt))
			.limit(limit);
	},

	async getByDedupeKey(dedupeKey: string): Promise<HandlerCall | undefined> {
		const [row] = await db
			.select()
			.from(handlerCalls)
			.where(eq(handlerCalls.dedupeKey, dedupeKey));
		return row;
	},

	/** Makes a pending call due now (admin "Retry now"). */
	async retrySoon(id: string, now: Date): Promise<boolean> {
		const updated = await db
			.update(handlerCalls)
			.set({ nextAttemptAt: now.toISOString() })
			.where(and(eq(handlerCalls.id, id), eq(handlerCalls.status, "pending")))
			.returning({ id: handlerCalls.id });
		return updated.length === 1;
	},
};
