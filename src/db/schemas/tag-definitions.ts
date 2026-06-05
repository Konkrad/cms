import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export const tagDefinitions = sqliteTable("tag_definitions", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  category: text("category", {
    enum: ["board", "qualification", "participation", "custom"],
  }).notNull(),
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(tagDefinitions);

export const insertTagDefinitionSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateTagDefinitionSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type TagDefinition = InferSelectModel<typeof tagDefinitions>;
export type InsertTagDefinition = z.infer<typeof insertTagDefinitionSchema>;
