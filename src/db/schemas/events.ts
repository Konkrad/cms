import { relations, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { inventoryGroups } from "./inventory-groups";
import { products } from "./products";
import { transactions } from "./transactions";
import { tickets } from "./tickets";
import { participationStatus } from "./participation-status";
import { eventPhotos } from "./event-photos";
import crypto from "crypto";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  salesStartDate: text("sales_start_date"),
  salesEndDate: text("sales_end_date"),
  locationType: text("location_type").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  longitude: text("longitude"),
  latitude: text("latitude"),
  onlineUrl: text("online_url"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  inventoryGroups: many(inventoryGroups),
  products: many(products),
  transactions: many(transactions),
  tickets: many(tickets),
  participationStatuses: many(participationStatus),
  photos: many(eventPhotos),
}));

const baseInsertSchema = createInsertSchema(events);
const baseSelectSchema = createSelectSchema(events);

export const insertEventSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    startDate: z.coerce.date().transform((d) => d.toISOString()),
    endDate: z.coerce.date().transform((d) => d.toISOString()),
    salesStartDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    salesEndDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    salesStartDate: true,
    salesEndDate: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateEventSchema = baseInsertSchema
  .omit({
    id: true,
    createdAt: true,
  })
  .partial()
  .extend({
    startDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    endDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    salesStartDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    salesEndDate: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  });

export const selectEventSchema = baseSelectSchema;

export type Event = z.infer<typeof selectEventSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
