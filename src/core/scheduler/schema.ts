import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

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

/**
 * Named handler calls that must happen and are retried until they succeed (spec 4.9: review
 * decisions call the owning module's `onApproved` / `onRejected`, like payment handlers). A
 * row names the handler (`owner` = module id or "core", `kind`, `type`, `hook`), never a
 * closure, so it survives restarts. `dedupeKey` makes each call happen once per decision.
 * Rows that failed at least once show in the admin failure view.
 */
export const handlerCalls = sqliteTable(
	"handler_calls",
	{
		id: text("id").primaryKey(),
		dedupeKey: text("dedupe_key").notNull(),
		owner: text("owner").notNull(),
		kind: text("kind").notNull(),
		type: text("type").notNull(),
		hook: text("hook").notNull(),
		payload: text("payload", { mode: "json" })
			.$type<Record<string, unknown>>()
			.notNull(),
		status: text("status", { enum: ["pending", "done"] })
			.notNull()
			.default("pending"),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		nextAttemptAt: text("next_attempt_at").notNull(),
		createdAt: text("created_at").notNull(),
		doneAt: text("done_at"),
	},
	(t) => [
		uniqueIndex("handler_calls_dedupe_unique").on(t.dedupeKey),
		index("handler_calls_due_idx").on(t.status, t.nextAttemptAt),
	],
);

export type HandlerCall = typeof handlerCalls.$inferSelect;
