import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { type ScheduleRun, scheduleRuns } from "~/core/scheduler/schema";

export const scheduleRunsService = {
	/** Creates the rows of new schedules, due right away. */
	async ensure(keys: readonly string[], now: Date): Promise<void> {
		if (!keys.length) return;
		const iso = now.toISOString();
		await db
			.insert(scheduleRuns)
			.values(keys.map((key) => ({ key, nextRunAt: iso, updatedAt: iso })))
			.onConflictDoNothing();
	},

	/**
	 * Takes the lease of a due schedule: true when this caller may run it now. False while it is
	 * not due or another run holds an unexpired lease.
	 */
	async claim(key: string, now: Date, leaseMs: number): Promise<boolean> {
		const iso = now.toISOString();
		const claimed = await db
			.update(scheduleRuns)
			.set({
				lockedUntil: new Date(now.getTime() + leaseMs).toISOString(),
				updatedAt: iso,
			})
			.where(
				and(
					eq(scheduleRuns.key, key),
					lte(scheduleRuns.nextRunAt, iso),
					or(
						isNull(scheduleRuns.lockedUntil),
						lte(scheduleRuns.lockedUntil, iso),
					),
				),
			)
			.returning({ key: scheduleRuns.key });
		return claimed.length === 1;
	},

	async markOk(key: string, now: Date, nextRunAt: Date): Promise<void> {
		await db
			.update(scheduleRuns)
			.set({
				lockedUntil: null,
				lastRunAt: now.toISOString(),
				lastStatus: "ok",
				lastError: null,
				failures: 0,
				nextRunAt: nextRunAt.toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(scheduleRuns.key, key));
	},

	async markFailed(
		key: string,
		now: Date,
		error: string,
		failures: number,
		nextRunAt: Date,
	): Promise<void> {
		await db
			.update(scheduleRuns)
			.set({
				lockedUntil: null,
				lastRunAt: now.toISOString(),
				lastStatus: "failed",
				lastError: error,
				failures,
				nextRunAt: nextRunAt.toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.where(eq(scheduleRuns.key, key));
	},

	async get(key: string): Promise<ScheduleRun | undefined> {
		const [row] = await db
			.select()
			.from(scheduleRuns)
			.where(eq(scheduleRuns.key, key));
		return row;
	},

	/** Schedules whose last run failed (the admin failure view). */
	async listFailing(): Promise<ScheduleRun[]> {
		return db
			.select()
			.from(scheduleRuns)
			.where(eq(scheduleRuns.lastStatus, "failed"))
			.orderBy(asc(scheduleRuns.key));
	},

	/** Makes a schedule due now (admin "Run now" after fixing the cause of a failure). */
	async runSoon(key: string, now: Date): Promise<boolean> {
		const updated = await db
			.update(scheduleRuns)
			.set({ nextRunAt: now.toISOString(), updatedAt: now.toISOString() })
			.where(eq(scheduleRuns.key, key))
			.returning({ key: scheduleRuns.key });
		return updated.length === 1;
	},
};
