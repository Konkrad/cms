import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";
import { users } from "./users";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  editorState: text("editor_state"),
  locationType: text("location_type", {
    enum: ["on-site", "remote-eu", "remote-country"],
  }).notNull(),
  city: text("city"),
  country: text("country"),
  link: text("link"),
  expiresAt: text("expires_at").notNull(),
  status: text("status", {
    enum: ["pending", "approved"],
  })
    .notNull()
    .default("pending"),
  suggestedBy: text("suggested_by")
    .notNull()
    .references(() => users.id),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(jobs);

export const insertJobSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  expiresAt: z.coerce.date().transform((d) => d.toISOString()),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

// updatedAt is handled by the service, not included in input
export const updateJobSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({
    expiresAt: z.coerce
      .date()
      .transform((d) => d.toISOString())
      .optional(),
  });

export type Job = InferSelectModel<typeof jobs>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type UpdateJob = z.infer<typeof updateJobSchema>;
