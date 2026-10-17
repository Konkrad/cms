import { and, desc, eq, inArray } from "drizzle-orm";
import { db, type PublicUser, publicUserColumns, usersService } from "~/core";
import type { products } from "../schema/products";
import { transactionItems } from "../schema/transaction-items";
import {
	type InsertTransaction,
	insertTransactionSchema,
	type PendingParticipants,
	type Transaction,
	type TransactionStatus,
	transactions,
} from "../schema/transactions";
import { type OwnTicket, ownTicketEventColumns } from "./tickets";

/** An order without who its tickets are for (participant emails stay server-side). */
export type TransactionSummary = Omit<Transaction, "participants">;

/** A purchase as its buyer sees it. */
export type OwnTransaction = TransactionSummary & {
	event: OwnTicket["event"];
	items: Array<
		typeof transactionItems.$inferSelect & {
			product: OwnTicket["product"];
		}
	>;
};

/** Moves an order from one of `from` to `to`; true when this call made the change. */
async function moveStatus(
	id: string,
	from: TransactionStatus[],
	to: TransactionStatus,
	extra: Partial<Pick<Transaction, "paymentDate">> = {},
): Promise<boolean> {
	const updated = await db
		.update(transactions)
		.set({ status: to, ...extra })
		.where(and(eq(transactions.id, id), inArray(transactions.status, from)))
		.returning({ id: transactions.id });
	return updated.length === 1;
}

export const transactionsService = {
	async create(data: InsertTransaction): Promise<Transaction> {
		const validated = insertTransactionSchema.parse(data);
		const [transaction] = await db
			.insert(transactions)
			.values(validated as any)
			.returning();
		return transaction;
	},

	async getById(id: string): Promise<Transaction | undefined> {
		const [transaction] = await db
			.select()
			.from(transactions)
			.where(eq(transactions.id, id));
		return transaction;
	},

	/**
	 * A pending order for a paid checkout: its line items at the DB prices and who the
	 * tickets are for. Nothing is reserved; tickets are issued when the payment arrives.
	 */
	async createPending(data: {
		eventId: string;
		userId: string;
		items: Array<{ productId: string; quantity: number; unitPrice: number }>;
		participants: PendingParticipants[];
	}): Promise<Transaction> {
		const transaction = await this.create({
			eventId: data.eventId,
			userId: data.userId,
			totalAmount: data.items.reduce(
				(sum, item) => sum + item.unitPrice * item.quantity,
				0,
			),
			transactionFee: 0,
			status: "pending",
			participants: data.participants,
		});
		await db.insert(transactionItems).values(
			data.items.map((item) => ({
				id: crypto.randomUUID(),
				transactionId: transaction.id,
				productId: item.productId,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				createdAt: new Date().toISOString(),
			})),
		);
		return transaction;
	},

	/** Removes a pending order whose checkout could not be created. */
	async deletePending(id: string): Promise<void> {
		const [pending] = await db
			.select({ id: transactions.id })
			.from(transactions)
			.where(and(eq(transactions.id, id), eq(transactions.status, "pending")));
		if (!pending) return;
		await db
			.delete(transactionItems)
			.where(eq(transactionItems.transactionId, id));
		await db.delete(transactions).where(eq(transactions.id, id));
	},

	async setPaymentId(id: string, paymentId: string): Promise<void> {
		await db
			.update(transactions)
			.set({ paymentId })
			.where(eq(transactions.id, id));
	},

	/** The order's line items. */
	async itemsOf(id: string) {
		return db
			.select()
			.from(transactionItems)
			.where(eq(transactionItems.transactionId, id));
	},

	/** Pending (or canceled: a late payment) → paid. */
	markPaid(id: string, now: Date): Promise<boolean> {
		return moveStatus(id, ["pending", "canceled"], "paid", {
			paymentDate: now.toISOString(),
		});
	},

	/** Pending → canceled (the checkout failed or expired). */
	cancelPending(id: string): Promise<boolean> {
		return moveStatus(id, ["pending"], "canceled");
	},

	/** Paid → refunded. */
	markRefunded(id: string): Promise<boolean> {
		return moveStatus(id, ["paid"], "refunded");
	},

	async getByEventId(eventId: string): Promise<Transaction[]> {
		return db
			.select()
			.from(transactions)
			.where(eq(transactions.eventId, eventId))
			.orderBy(desc(transactions.paymentDate));
	},

	/** The user's own completed (or refunded) purchases with an event summary and line items. */
	async getByUserId(userId: string): Promise<OwnTransaction[]> {
		const results = await db.query.transactions.findMany({
			where: { userId, status: { in: ["paid", "refunded"] } },
			columns: { participants: false },
			with: {
				event: { columns: ownTicketEventColumns },
				items: {
					with: { product: true },
				},
			},
			orderBy: { paymentDate: "desc" },
		});
		return results as OwnTransaction[];
	},

	/**
	 * PRIVATE: an event's orders with line items, status and the buyer's login email, for the
	 * admin transactions page only.
	 */
	async getByEventIdWithBuyerEmail(eventId: string): Promise<
		Array<
			TransactionSummary & {
				user: PublicUser & { email: string | null };
				items: Array<
					typeof transactionItems.$inferSelect & {
						product: typeof products.$inferSelect;
					}
				>;
			}
		>
	> {
		const results = await db.query.transactions.findMany({
			where: { eventId },
			columns: { participants: false },
			with: {
				user: { columns: publicUserColumns },
				items: {
					with: {
						product: true,
					},
				},
			},
			orderBy: { paymentDate: "desc" },
		});
		const emails = await usersService.getEmailsByIds([
			...new Set(results.map((r) => r.userId)),
		]);
		return results.map((r) => ({
			...r,
			user: { ...(r.user as PublicUser), email: emails.get(r.userId) ?? null },
		}));
	},
};
