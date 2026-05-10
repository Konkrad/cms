import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { sqliteTable, text, unique, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { users } from "./users";
import crypto from "crypto";

export const participationStatus = sqliteTable(
  "participation_status",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["yes", "no", "maybe"] }).notNull(),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueUserEvent: unique().on(table.userId, table.eventId),
    eventIdIdx: index("participation_status_event_id_idx").on(table.eventId),
  }),
);

export const participationStatusRelations = relations(
  participationStatus,
  ({ one }) => ({
    user: one(users, {
      fields: [participationStatus.userId],
      references: [users.id],
    }),
    event: one(events, {
      fields: [participationStatus.eventId],
      references: [events.id],
    }),
  }),
);

const baseInsertSchema = createInsertSchema(participationStatus);
const baseSelectSchema = createSelectSchema(participationStatus);

export const insertParticipationStatusSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    status: z.enum(["yes", "no", "maybe"]),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({ id: true, updatedAt: true });

export const selectParticipationStatusSchema = baseSelectSchema;

export type ParticipationStatus = z.infer<
  typeof selectParticipationStatusSchema
>;
export type InsertParticipationStatus = z.infer<
  typeof insertParticipationStatusSchema
>;
