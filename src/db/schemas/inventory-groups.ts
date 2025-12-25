import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { products } from "./products";
import crypto from "crypto";

export const inventoryGroups = sqliteTable("inventory_groups", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  maxCapacity: integer("max_capacity").notNull(),
  needsTicket: integer("needs_ticket", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const inventoryGroupsRelations = relations(inventoryGroups, ({ one, many }) => ({
  event: one(events, {
    fields: [inventoryGroups.eventId],
    references: [events.id],
  }),
  products: many(products),
}));

const baseInsertSchema = createInsertSchema(inventoryGroups);
const baseSelectSchema = createSelectSchema(inventoryGroups);

export const insertInventoryGroupSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
  });

export const updateInventoryGroupSchema = baseInsertSchema
  .omit({ id: true, createdAt: true })
  .partial();

export const selectInventoryGroupSchema = baseSelectSchema;

export type InventoryGroup = z.infer<typeof selectInventoryGroupSchema>;
export type InsertInventoryGroup = z.infer<typeof insertInventoryGroupSchema>;
export type UpdateInventoryGroup = z.infer<typeof updateInventoryGroupSchema>;
