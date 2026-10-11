import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { users } from "../users/schema";

/**
 * One row per recipient and channel, written by `notify()` and drained by the outbox worker.
 *
 * `recipientAddress` is resolved at enqueue time (email from the user id, chat id for an ops
 * target) and stored on the row: the row is then a self-contained record of where a message
 * went (the admin failure view shows it, a retry goes to the same address), ops targets have
 * no user to re-resolve from, and the worker needs no per-channel lookup. The cost is a copy
 * of the address in the outbox, so rows cascade away with their user.
 */
export const notificationOutbox = sqliteTable(
	"notification_outbox",
	{
		id: text("id").primaryKey(),
		notificationId: text("notification_id").notNull(),
		channel: text("channel").notNull(),
		recipientUserId: text("recipient_user_id").references(() => users.id, {
			onDelete: "cascade",
		}),
		recipientAddress: text("recipient_address"),
		data: text("data", { mode: "json" })
			.$type<Record<string, unknown>>()
			.notNull(),
		status: text("status", { enum: ["pending", "sent", "failed"] })
			.notNull()
			.default("pending"),
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
		nextAttemptAt: text("next_attempt_at").notNull(),
		createdAt: text("created_at").notNull(),
		sentAt: text("sent_at"),
	},
	(t) => [index("notification_outbox_due_idx").on(t.status, t.nextAttemptAt)],
);

export type NotificationOutboxRow = typeof notificationOutbox.$inferSelect;
export type NewNotificationOutboxRow = typeof notificationOutbox.$inferInsert;

/**
 * Per-user mutes for OPTIONAL notifications (`optional: true`), one row per notification and
 * channel. No row means enabled. Required notifications ignore this table.
 */
export const notificationPreferences = sqliteTable(
	"notification_preferences",
	{
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		notificationId: text("notification_id").notNull(),
		channel: text("channel").notNull(),
		enabled: integer("enabled", { mode: "boolean" }).notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	(t) => [primaryKey({ columns: [t.userId, t.notificationId, t.channel] })],
);
