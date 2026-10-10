import { and, desc, eq } from "drizzle-orm";
import { db, type PublicUser, publicUserColumns, usersService } from "~/core";
import type { events } from "../schema/events";
import type { products } from "../schema/products";
import type { transactionItems } from "../schema/transaction-items";
import {
	type InsertTransaction,
	insertTransactionSchema,
	type Transaction,
	transactions,
} from "../schema/transactions";

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

	async getByUserId(userId: string): Promise<
		Array<
			Transaction & {
				event: typeof events.$inferSelect;
				items: Array<
					typeof transactionItems.$inferSelect & {
						product: typeof products.$inferSelect;
					}
				>;
			}
		>
	> {
		const results = await db.query.transactions.findMany({
			where: { userId },
			with: {
				event: true,
				items: {
					with: {
						product: true,
					},
				},
			},
			orderBy: { paymentDate: "desc" },
		});
		return results as any;
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
						product: typeof products.$inferSelect;
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
