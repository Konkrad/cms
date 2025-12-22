import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { BlockData } from "./shared";

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

export const insertPageSchema = createInsertSchema(pages, {
  title: z.string().min(1, "Title is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^(\/|[a-z0-9-]+)$/,
      'Slug must be "/" for home page, or contain only lowercase letters, numbers, and hyphens',
    ),
});
export const selectPageSchema = createSelectSchema(pages);

export type Page = z.infer<typeof selectPageSchema>;
export type NewPage = z.infer<typeof insertPageSchema>;
