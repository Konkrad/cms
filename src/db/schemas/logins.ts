import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

/**
 * 'logins' table
 *
 * - Stores both the magic-link hash and the OTP (as hashed values) in the same row.
 * - One row per email (unique constraint on `email`).
 * - `otpAttempts` counts failed OTP verification attempts (max 5).
 * - `magicUsed` / `otpUsed` mark whether the corresponding method has been consumed.
 *
 * Notes:
 * - Application logic should replace (upsert) an existing row when generating a new login
 *   for the same email (ensures a single row per email).
 * - It's recommended to store hashed values for both `magicHash` and `otpHash`.
 */
export const logins = sqliteTable("logins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  // Hash of the magic link token (store a secure hash, not the raw token)
  magicHash: text("magic_hash"),
  // Hash of the OTP code (store a secure hash, not the raw code)
  otpHash: text("otp_hash"),
  // Single expiry timestamp used for both magic link and OTP in the current flow
  expiresAt: text("expires_at").notNull(),
  // Counter for OTP verification attempts (increment on each invalid OTP)
  otpAttempts: integer("otp_attempts").notNull().default(0),
  // Flags to mark if a method has been used/consumed
  magicUsed: integer("magic_used", { mode: "boolean" })
    .notNull()
    .default(false),
  otpUsed: integer("otp_used", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(logins);
const baseSelectSchema = createSelectSchema(logins);

export const insertLoginSchema = baseInsertSchema
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
    otpAttempts: true,
    magicUsed: true,
    otpUsed: true,
  });

export const selectLoginSchema = baseSelectSchema;

export type Login = z.infer<typeof selectLoginSchema>;
export type InsertLogin = z.infer<typeof insertLoginSchema>;
