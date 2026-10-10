import crypto from "crypto";
import { sql } from "drizzle-orm";
import { index, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "~/core-api/db-schema";
import { events } from "./events";

export const participationStatus = sqliteTable(
	"participation_status",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		status: text("status", { enum: ["yes", "no", "maybe"] }).notNull(),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => ({
		uniqueUserEvent: unique().on(table.userId, table.eventId),
		eventIdIdx: index("participation_status_event_id_idx").on(table.eventId),
	}),
);

const baseInsertSchema = createInsertSchema(participationStatus);
const baseSelectSchema = createSelectSchema(participationStatus);

export const insertParticipationStatusSchema = baseInsertSchema
	.extend({
		id: z
			.string()
			.uuid()
			.default(() => crypto.randomUUID()),
		status: z.enum(["yes", "no", "maybe"]),
		updatedAt: z.string().default(() => new Date().toISOString()),
	})
	.partial({ id: true, updatedAt: true });

export const selectParticipationStatusSchema = baseSelectSchema;

export type ParticipationStatus = z.infer<
	typeof selectParticipationStatusSchema
>;
export type InsertParticipationStatus = z.infer<
	typeof insertParticipationStatusSchema
>;
