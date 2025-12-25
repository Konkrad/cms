import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { inventoryGroups } from "./inventory-groups";
import { transactionItems } from "./transaction-items";
import crypto from "crypto";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  inventoryGroupId: text("inventory_group_id")
    .notNull()
    .references(() => inventoryGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: real("price").notNull(),
  maxQuantity: integer("max_quantity").notNull().default(0),
  features: text("features", { mode: "json" }).notNull().$type<string[]>(),
  imageUrl: text("image_url"),
  stripeProductId: text("stripe_product_id"),
  soldQuantity: integer("sold_quantity").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const productsRelations = relations(products, ({ one, many }) => ({
  event: one(events, {
    fields: [products.eventId],
    references: [events.id],
  }),
  inventoryGroup: one(inventoryGroups, {
    fields: [products.inventoryGroupId],
    references: [inventoryGroups.id],
  }),
  transactionItems: many(transactionItems),
}));

const baseInsertSchema = createInsertSchema(products);
const baseSelectSchema = createSelectSchema(products);

export const insertProductSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    price: z.number().positive(),
    maxQuantity: z.number().int().min(0),
    features: z.array(z.string()).default([]),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    imageUrl: true,
    stripeProductId: true,
    soldQuantity: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateProductSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, soldQuantity: true })
  .partial()
  .extend({
    updatedAt: z.string().default(() => new Date().toISOString()),
  });

export const selectProductSchema = baseSelectSchema;

export type Product = z.infer<typeof selectProductSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
