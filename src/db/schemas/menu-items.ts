import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  menuName: text('menu_name').notNull(),
  label: text('label').notNull(),
  url: text('url').notNull(),
  parentId: text('parent_id'),
  position: integer('position').notNull().default(0),
  icon: text('icon'),
  target: text('target', { enum: ['_self', '_blank', '_parent', '_top'] })
    .notNull()
    .default('_self'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const insertMenuItemSchema = createInsertSchema(menuItems);
export const selectMenuItemSchema = createSelectSchema(menuItems);

export type MenuItem = z.infer<typeof selectMenuItemSchema>;
export type NewMenuItem = z.infer<typeof insertMenuItemSchema>;

export interface MenuItemTree extends MenuItem {
  children?: MenuItemTree[];
}
