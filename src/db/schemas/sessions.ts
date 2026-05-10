import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import crypto from "crypto";

/**
 * Sessions stored in DB for server-side session verification.
 *
 * - `token` is a secure random token set as an HTTP-only cookie on the client.
 * - `user_id` links to the `users.id` value.
 * - `expires_at` determines when the session becomes invalid.
 * - `ip` and `user_agent` are optional metadata useful for auditing and session invalidation.
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  loginId: text("login_id"),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

const baseInsertSchema = createInsertSchema(sessions);
const baseSelectSchema = createSelectSchema(sessions);

export const insertSessionSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    createdAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
  });

export const selectSessionSchema = baseSelectSchema;

export type Session = z.infer<typeof selectSessionSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
