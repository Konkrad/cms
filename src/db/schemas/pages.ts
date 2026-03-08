import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { BlockData } from "./shared";
import crypto from "crypto";

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: text("parent_id"),
  content: text("content", { mode: "json" }).$type<BlockData[]>(),
  status: text("status", { enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(pages);
const baseSelectSchema = createSelectSchema(pages);

const slugValidation = z
  .string()
  .min(1, "Slug is required")
  .regex(
    /^\/?[a-z0-9-]+(\/[a-z0-9-]+)*$|^\/$/,
    'Slug must be "/" for home page, or a path of lowercase letters, numbers, and hyphens (e.g. "groups" or "/groups/subpage")',
  );

export const insertPageSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    title: z.string().min(1, "Title is required"),
    slug: slugValidation,
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    createdAt: true,
    updatedAt: true,
    status: true,
  });

export const updatePageSchema = baseInsertSchema
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    title: z.string().min(1, "Title is required").optional(),
    slug: slugValidation.optional(),
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  })
  .partial();

export const selectPageSchema = baseSelectSchema;

export type Page = z.infer<typeof selectPageSchema>;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type UpdatePage = z.infer<typeof updatePageSchema>;
