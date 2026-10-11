import { and, desc, eq } from "drizzle-orm";
import { db, type PublicUser, publicUserColumns, usersService } from "~/core";
import type { products } from "../schema/products";
import type { transactionItems } from "../schema/transaction-items";
import {
	type InsertTransaction,
	insertTransactionSchema,
	type Transaction,
	transactions,
} from "../schema/transactions";
import { type OwnTicket, ownTicketEventColumns } from "./tickets";

/** A purchase as its buyer sees it: no Stripe ids. */
export type OwnTransaction = Omit<
	Transaction,
	"stripeSessionId" | "stripePaymentId"
> & {
	event: OwnTicket["event"];
	items: Array<
		typeof transactionItems.$inferSelect & {
			product: OwnTicket["product"];
		}
	>;
};

export const transactionsService = {
	async create(data: InsertTransaction): Promise<Transaction> {
		const validated = insertTransactionSchema.parse(data);
		const [transaction] = await db
			.insert(transactions)
			.values(validated as any)
			.returning();
		return transaction;
	},

	async findByPaymentId(
		stripePaymentId: string,
	): Promise<Transaction | undefined> {
		const [transaction] = await db
			.select()
			.from(transactions)
			.where(eq(transactions.stripePaymentId, stripePaymentId))
			.limit(1);
		return transaction;
	},

	async getByEventId(eventId: string): Promise<Transaction[]> {
		return db
			.select()
			.from(transactions)
			.where(eq(transactions.eventId, eventId))
			.orderBy(desc(transactions.paymentDate));
	},

	/** The user's own purchases (without Stripe ids) with an event summary and line items. */
	async getByUserId(userId: string): Promise<OwnTransaction[]> {
		const results = await db.query.transactions.findMany({
			where: { userId },
			columns: { stripeSessionId: false, stripePaymentId: false },
			with: {
				event: { columns: ownTicketEventColumns },
				items: {
					with: { product: { columns: { stripeProductId: false } } },
				},
			},
			orderBy: { paymentDate: "desc" },
		});
		return results as OwnTransaction[];
	},

	/**
	 * PRIVATE: an event's transactions with line items, Stripe ids and the buyer's login
	 * email, for the admin transactions page only.
	 */
	async getByEventIdWithBuyerEmail(eventId: string): Promise<
		Array<
			Transaction & {
				user: PublicUser & { email: string | null };
				items: Array<
					typeof transactionItems.$inferSelect & {
						product: OwnTicket["product"];
					}
				>;
			}
		>
	> {
		const results = await db.query.transactions.findMany({
			where: { eventId },
			with: {
				user: { columns: publicUserColumns },
				items: {
					with: {
						product: { columns: { stripeProductId: false } },
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
