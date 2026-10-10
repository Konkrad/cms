import crypto from "crypto";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "~/core-api/db-schema";
import { tickets } from "./tickets";

export const ticketParticipants = sqliteTable(
	"ticket_participants",
	{
		id: text("id").primaryKey(),
		ticketId: text("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		participantOrder: integer("participant_order").notNull(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		userId: text("user_id").references(() => users.id),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => ({
		uniqueTicketOrder: unique().on(table.ticketId, table.participantOrder),
	}),
);

const baseInsertSchema = createInsertSchema(ticketParticipants);
const baseSelectSchema = createSelectSchema(ticketParticipants);

export const insertTicketParticipantSchema = baseInsertSchema
	.extend({
		id: z
			.string()
			.uuid()
			.default(() => crypto.randomUUID()),
		email: z.string().email(),
		participantOrder: z.number().int().min(1),
		createdAt: z.string().default(() => new Date().toISOString()),
	})
	.partial({ id: true, userId: true, createdAt: true });

export const selectTicketParticipantSchema = baseSelectSchema;

export type TicketParticipant = z.infer<typeof selectTicketParticipantSchema>;
export type InsertTicketParticipant = z.infer<
	typeof insertTicketParticipantSchema
>;
