import crypto from "crypto";
import { sql } from "drizzle-orm";
import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { payments, users } from "~/core/schema";
import { events } from "./events";

export const TRANSACTION_STATUSES = [
	"pending",
	"paid",
	"canceled",
	"refunded",
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Who a paid ticket is for, kept on the pending order until the payment arrives. */
export interface PendingParticipants {
	productId: string;
	participantUnits: Array<
		Array<{ name: string; email: string; existingUserId?: string | null }>
	>;
}

/**
 * An order (the events module's domain record). Free orders are `paid` at once and have no
 * payment. A paid order starts `pending` with its core payment (`paymentId`, spec 4.7); the
 * payment handlers move it to `paid` (tickets issued), `canceled` (checkout failed or expired)
 * or `refunded`. `participants` holds who the tickets are for until they are issued.
 */
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
	status: text("status", { enum: TRANSACTION_STATUSES })
		.notNull()
		.default("paid"),
	paymentId: text("payment_id")
		.unique()
		.references(() => payments.id),
	participants: text("participants", { mode: "json" }).$type<
		PendingParticipants[]
	>(),
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
		participants: z.array(z.any()).nullable(),
	})
	.partial({
		id: true,
		status: true,
		paymentId: true,
		participants: true,
		paymentDate: true,
		createdAt: true,
	});

export const selectTransactionSchema = baseSelectSchema;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = Omit<
	z.infer<typeof insertTransactionSchema>,
	"participants"
> & { participants?: PendingParticipants[] | null };
