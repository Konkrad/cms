import { db } from "~/db/connection";
import {
  transactions,
  insertTransactionSchema,
  type Transaction,
  type InsertTransaction,
} from "~/db/schemas/transactions";
import { transactionItems } from "~/db/schemas/transaction-items";
import { products } from "~/db/schemas/products";
import { users } from "~/db/schemas/users";
import { events } from "~/db/schemas/events";
import { eq, desc, and } from "drizzle-orm";

export const transactionsService = {
  async create(data: InsertTransaction): Promise<Transaction> {
    const validated = insertTransactionSchema.parse(data);
    const [transaction] = await db
      .insert(transactions)
      .values(validated as any)
      .returning();
    return transaction;
  },

  async findBySessionId(
    stripeSessionId: string,
  ): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.stripeSessionId, stripeSessionId))
      .limit(1);
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

  async processCheckout(
    stripeSessionId: string,
    stripePaymentId: string,
  ): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set({
        stripePaymentId,
        paymentDate: new Date().toISOString(),
      })
      .where(eq(transactions.stripeSessionId, stripeSessionId))
      .returning();
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

  async getByEventIdWithDetails(eventId: string): Promise<
    Array<
      Transaction & {
        user: typeof users.$inferSelect;
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
        user: true,
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
};
