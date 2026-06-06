import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";
import { users } from "./users";

export const userTags = sqliteTable(
  "user_tags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    category: text("category", {
      enum: ["board", "qualification", "participation", "custom"],
    }).notNull(),
    sourceType: text("source_type", {
      enum: ["manual", "qualification", "election", "rule"],
    }).notNull(),
    sourceId: text("source_id"),
    grantedBy: text("granted_by").references(() => users.id),
    grantedAt: text("granted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [unique().on(t.userId, t.slug)],
);

const baseInsertSchema = createInsertSchema(userTags);

export const insertUserTagSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  grantedAt: z.string().default(() => new Date().toISOString()),
});

export const updateUserTagSchema = baseInsertSchema
  .omit({ id: true, grantedAt: true })
  .partial();

export type UserTag = InferSelectModel<typeof userTags>;
export type InsertUserTag = z.infer<typeof insertUserTagSchema>;
export type UpdateUserTag = z.infer<typeof updateUserTagSchema>;
