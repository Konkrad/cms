import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { transactions } from "./transactions";
import { products } from "./products";
import { events } from "./events";
import { users } from "./users";
import { ticketParticipants } from "./ticket-participants";
import crypto from "crypto";

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    qrCodeUuid: text("qr_code_uuid").notNull().unique(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    buyerId: text("buyer_id")
      .notNull()
      .references(() => users.id),
    scannedAt: text("scanned_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    scannedAtIdx: index("tickets_scanned_at_idx").on(table.scannedAt),
    eventScannedIdx: index("tickets_event_scanned_idx").on(
      table.eventId,
      table.scannedAt,
    ),
  }),
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  transaction: one(transactions, {
    fields: [tickets.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [tickets.productId],
    references: [products.id],
  }),
  event: one(events, {
    fields: [tickets.eventId],
    references: [events.id],
  }),
  buyer: one(users, {
    fields: [tickets.buyerId],
    references: [users.id],
  }),
  participants: many(ticketParticipants),
}));

const baseInsertSchema = createInsertSchema(tickets);
const baseSelectSchema = createSelectSchema(tickets);

export const insertTicketSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    qrCodeUuid: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    qrCodeUuid: true,
    scannedAt: true,
    createdAt: true,
  });

export const updateTicketSchema = baseInsertSchema
  .pick({ scannedAt: true })
  .partial();

export const selectTicketSchema = baseSelectSchema;

export type Ticket = z.infer<typeof selectTicketSchema>;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type UpdateTicket = z.infer<typeof updateTicketSchema>;
