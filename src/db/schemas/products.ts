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
  participantCapacity: integer("participant_capacity").notNull().default(1),
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
    participantCapacity: z.number().int().min(1).default(1),
    features: z.array(z.string()).default([]),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    participantCapacity: true,
    imageUrl: true,
    stripeProductId: true,
    soldQuantity: true,
    createdAt: true,
    updatedAt: true,
  });

// Form-compatible version that handles HTML form string inputs
export const formProductSchema = insertProductSchema
  .omit({ 
    id: true, 
    eventId: true, 
    stripeProductId: true, 
    soldQuantity: true, 
    createdAt: true, 
    updatedAt: true 
  })
  .extend({
    price: z.union([
      z.string().transform(val => parseFloat(val)),
      z.number()
    ]).pipe(z.number().positive("Price must be greater than 0")),
    maxQuantity: z.union([
      z.string().transform(val => parseInt(val, 10)),
      z.number().int()
    ]).pipe(z.number().int().min(0, "Max quantity cannot be negative")),
    participantCapacity: z.union([
      z.string().transform(val => parseInt(val, 10)),
      z.number().int()
    ]).pipe(z.number().int().min(1, "Participant capacity must be at least 1")).default(1),
    features: z.string().default(""),
    imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
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
