import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * One row per schedule (`<owner>.<id>`): when it last ran and how, when it is due next, and a
 * lease (`lockedUntil`) a process takes before running it. Claiming is a conditional update,
 * so two processes (or a restart in the middle of a run) never run a schedule twice.
 */
export const scheduleRuns = sqliteTable("schedule_runs", {
	key: text("key").primaryKey(),
	nextRunAt: text("next_run_at").notNull(),
	lockedUntil: text("locked_until"),
	lastRunAt: text("last_run_at"),
	lastStatus: text("last_status", { enum: ["ok", "failed"] }),
	lastError: text("last_error"),
	/** Consecutive failed runs (0 after a success). */
	failures: integer("failures").notNull().default(0),
	updatedAt: text("updated_at").notNull(),
});

export type ScheduleRun = typeof scheduleRuns.$inferSelect;
