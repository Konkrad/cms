import { db } from "~/core";
import {
	type InsertTransactionItem,
	insertTransactionItemSchema,
	type TransactionItem,
	transactionItems,
} from "../schema/transaction-items";

export const transactionItemsService = {
	async createBulk(
		items: Array<Omit<InsertTransactionItem, "id" | "createdAt">>,
	): Promise<TransactionItem[]> {
		const validated = items.map((item) =>
			insertTransactionItemSchema.parse(item),
		);
		const result = await db
			.insert(transactionItems)
			.values(validated as any)
			.returning();
		return result;
	},
};
