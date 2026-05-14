import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import type { BlockData } from "./shared";
import crypto from "crypto";

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
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

export const insertPageSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
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
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  })
  .partial();

export const selectPageSchema = baseSelectSchema;

export type Page = Omit<z.infer<typeof selectPageSchema>, "content"> & {
  content: BlockData[] | null;
};
export type InsertPage = Omit<z.infer<typeof insertPageSchema>, "content"> & {
  content?: BlockData[] | null;
};
export type UpdatePage = Omit<z.infer<typeof updatePageSchema>, "content"> & {
  content?: BlockData[] | null;
};
