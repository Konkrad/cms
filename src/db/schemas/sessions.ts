import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

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
	userId: text("user_id"),
	loginId: text("login_id"),
	token: text("token").notNull().unique(),
	expiresAt: text("expires_at").notNull(),
	ip: text("ip"),
	userAgent: text("user_agent"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);

export type Session = z.infer<typeof selectSessionSchema>;
export type NewSession = z.infer<typeof insertSessionSchema>;
