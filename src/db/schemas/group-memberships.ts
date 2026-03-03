import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { groups } from "./groups";
import crypto from "crypto";

export const groupMemberships = sqliteTable(
  "group_memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    uniqueMembership: unique().on(table.userId, table.groupId),
  })
);

export const groupMembershipsRelations = relations(
  groupMemberships,
  ({ one }) => ({
    user: one(users, {
      fields: [groupMemberships.userId],
      references: [users.id],
    }),
    group: one(groups, {
      fields: [groupMemberships.groupId],
      references: [groups.id],
    }),
  })
);

const baseInsertSchema = createInsertSchema(groupMemberships);
const baseSelectSchema = createSelectSchema(groupMemberships);

export const insertGroupMembershipSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    joinedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    joinedAt: true,
  });

export const selectGroupMembershipSchema = baseSelectSchema;

export type GroupMembership = z.infer<typeof selectGroupMembershipSchema>;
export type InsertGroupMembership = z.infer<
  typeof insertGroupMembershipSchema
>;
