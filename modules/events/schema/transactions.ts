import crypto from "crypto";
import { sql } from "drizzle-orm";
import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "~/core-api/db-schema";
import { events } from "./events";

export const transactions = sqliteTable("transactions", {
	id: text("id").primaryKey(),
	eventId: text("event_id")
		.notNull()
		.references(() => events.id),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	totalAmount: real("total_amount").notNull(),
	transactionFee: real("transaction_fee").notNull().default(0),
	stripeSessionId: text("stripe_session_id").notNull().unique(),
	stripePaymentId: text("stripe_payment_id"),
	paymentDate: text("payment_date").notNull().default(sql`CURRENT_TIMESTAMP`),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(transactions);
const baseSelectSchema = createSelectSchema(transactions);

export const insertTransactionSchema = baseInsertSchema
	.extend({
		id: z
			.string()
			.uuid()
			.default(() => crypto.randomUUID()),
		totalAmount: z.number().min(0),
		transactionFee: z.number().min(0),
		paymentDate: z.string().default(() => new Date().toISOString()),
		createdAt: z.string().default(() => new Date().toISOString()),
	})
	.partial({
		id: true,
		stripePaymentId: true,
		paymentDate: true,
		createdAt: true,
	});

export const selectTransactionSchema = baseSelectSchema;

export type Transaction = z.infer<typeof selectTransactionSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
