import { db } from "~/db/connection";
import {
  transactionItems,
  insertTransactionItemSchema,
  type TransactionItem,
  type InsertTransactionItem,
} from "~/db/schemas/transaction-items";

export const transactionItemsService = {
  async createBulk(
    items: Array<Omit<InsertTransactionItem, "id" | "createdAt">>,
  ): Promise<TransactionItem[]> {
    const validated = items.map((item) => insertTransactionItemSchema.parse(item));
    const result = await db.insert(transactionItems).values(validated as any).returning();
    return result;
  },
};
