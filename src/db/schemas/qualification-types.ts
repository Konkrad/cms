import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export const qualificationTypes = sqliteTable("qualification_types", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  grantsMembershipTier: text("grants_membership_tier", {
    enum: ["associated", "full"],
  }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(qualificationTypes);

export const insertQualificationTypeSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateQualificationTypeSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type QualificationType = InferSelectModel<typeof qualificationTypes>;
export type InsertQualificationType = z.infer<typeof insertQualificationTypeSchema>;
export type UpdateQualificationType = z.infer<typeof updateQualificationTypeSchema>;
