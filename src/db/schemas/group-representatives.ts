import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { groups } from "./groups";
import crypto from "crypto";

export const groupRepresentatives = sqliteTable(
  "group_representatives",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    promotedAt: text("promoted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    promotedBy: text("promoted_by")
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    uniqueRepresentative: unique().on(table.userId, table.groupId),
  })
);

export const groupRepresentativesRelations = relations(
  groupRepresentatives,
  ({ one }) => ({
    user: one(users, {
      fields: [groupRepresentatives.userId],
      references: [users.id],
    }),
    group: one(groups, {
      fields: [groupRepresentatives.groupId],
      references: [groups.id],
    }),
    promoter: one(users, {
      fields: [groupRepresentatives.promotedBy],
      references: [users.id],
    }),
  })
);

const baseInsertSchema = createInsertSchema(groupRepresentatives);
const baseSelectSchema = createSelectSchema(groupRepresentatives);

export const insertGroupRepresentativeSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    promotedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    promotedAt: true,
  });

export const selectGroupRepresentativeSchema = baseSelectSchema;

export type GroupRepresentative = z.infer<
  typeof selectGroupRepresentativeSchema
>;
export type InsertGroupRepresentative = z.infer<
  typeof insertGroupRepresentativeSchema
>;
