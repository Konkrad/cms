import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { transactions } from "./transactions";
import { products } from "./products";
import crypto from "crypto";

export const transactionItems = sqliteTable("transaction_items", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id")
    .notNull()
    .references(() => transactions.id, { onDelete: "cascade" }),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
}));

const baseInsertSchema = createInsertSchema(transactionItems);
const baseSelectSchema = createSelectSchema(transactionItems);

export const insertTransactionItemSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
  });

export const selectTransactionItemSchema = baseSelectSchema;

export type TransactionItem = z.infer<typeof selectTransactionItemSchema>;
export type InsertTransactionItem = z.infer<typeof insertTransactionItemSchema>;
