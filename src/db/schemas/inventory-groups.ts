import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { products } from "./products";
import crypto from "crypto";

export const inventoryGroups = sqliteTable(
  "inventory_groups",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    maxCapacity: integer("max_capacity").notNull(),
    needsTicket: integer("needs_ticket", { mode: "boolean" })
      .notNull()
      .default(true),
    salesStartDate: text("sales_start_date"),
    salesEndDate: text("sales_end_date"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    salesStartIdx: index("inventory_groups_sales_start_idx").on(
      table.salesStartDate,
    ),
    salesEndIdx: index("inventory_groups_sales_end_idx").on(table.salesEndDate),
  }),
);

export const inventoryGroupsRelations = relations(
  inventoryGroups,
  ({ one, many }) => ({
    event: one(events, {
      fields: [inventoryGroups.eventId],
      references: [events.id],
    }),
    products: many(products),
  }),
);

const baseInsertSchema = createInsertSchema(inventoryGroups);
const baseSelectSchema = createSelectSchema(inventoryGroups);

export const insertInventoryGroupSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    salesStartDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    salesEndDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    salesStartDate: true,
    salesEndDate: true,
    createdAt: true,
  });

// Form-compatible version that handles HTML form string inputs
export const formInventoryGroupSchema = insertInventoryGroupSchema
  .omit({ id: true, eventId: true, createdAt: true })
  .extend({
    maxCapacity: z
      .union([
        z.string().transform((val) => parseInt(val, 10)),
        z.number().int(),
      ])
      .pipe(z.number().int().positive("Max capacity must be greater than 0")),
    needsTicket: z
      .union([
        z.string().transform((val) => val === "on" || val === "true"),
        z.boolean(),
      ])
      .default(true),
    salesStartDate: z
      .union([
        z
          .string()
          .transform((val) =>
            val === "" ? undefined : new Date(val).toISOString(),
          ),
        z.coerce.date().transform((d) => d.toISOString()),
      ])
      .optional(),
    salesEndDate: z
      .union([
        z
          .string()
          .transform((val) =>
            val === "" ? undefined : new Date(val).toISOString(),
          ),
        z.coerce.date().transform((d) => d.toISOString()),
      ])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.salesStartDate && data.salesEndDate) {
      if (new Date(data.salesStartDate) > new Date(data.salesEndDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sales start date must be before sales end date",
          path: ["salesStartDate"],
        });
      }
    }
  });

export const updateInventoryGroupSchema = baseInsertSchema
  .omit({ id: true, createdAt: true })
  .partial()
  .extend({
    salesStartDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    salesEndDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
  });

export const selectInventoryGroupSchema = baseSelectSchema;

export type InventoryGroup = z.infer<typeof selectInventoryGroupSchema>;
export type InsertInventoryGroup = z.infer<typeof insertInventoryGroupSchema>;
export type UpdateInventoryGroup = z.infer<typeof updateInventoryGroupSchema>;
