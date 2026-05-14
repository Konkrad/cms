import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(),
  menuName: text("menu_name").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  pageId: text("page_id"),
  parentId: text("parent_id"),
  position: integer("position").notNull().default(0),
  status: text("status", { enum: ["visible", "hidden"] }).notNull().default("hidden"),
  icon: text("icon"),
  target: text("target", { enum: ["_self", "_blank", "_parent", "_top"] })
    .notNull()
    .default("_self"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(menuItems);
const baseSelectSchema = createSelectSchema(menuItems);

export const insertMenuItemSchema = baseInsertSchema
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
    position: true,
    target: true,
    pageId: true,
  });

export const updateMenuItemSchema = baseInsertSchema
  .omit({
    id: true,
    createdAt: true,
  })
  .partial()
  .extend({
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  });

export const selectMenuItemSchema = baseSelectSchema;

export type MenuItem = z.infer<typeof selectMenuItemSchema>;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type UpdateMenuItem = z.infer<typeof updateMenuItemSchema>;

export interface MenuItemTree extends MenuItem {
  children?: MenuItemTree[];
}
