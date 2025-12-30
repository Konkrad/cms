import { relations, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const groupsRelations = relations(groups, ({ many }) => ({
  memberships: many(groupMemberships),
  representatives: many(groupRepresentatives),
  posts: many(posts),
  events: many(events),
}));

// Import for relations - placed after table definition to avoid circular dependency issues
import { groupMemberships } from "./group-memberships";
import { groupRepresentatives } from "./group-representatives";
import { posts } from "./posts";
import { events } from "./events";

const baseInsertSchema = createInsertSchema(groups);
const baseSelectSchema = createSelectSchema(groups);

export const insertGroupSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    latitude: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -90 && num <= 90;
      },
      { message: "Latitude must be between -90 and 90" }
    ),
    longitude: z.string().refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= -180 && num <= 180;
      },
      { message: "Longitude must be between -180 and 180" }
    ),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    slug: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateGroupSchema = baseInsertSchema
  .omit({
    id: true,
    createdAt: true,
  })
  .partial()
  .extend({
    latitude: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= -90 && num <= 90;
        },
        { message: "Latitude must be between -90 and 90" }
      )
      .optional(),
    longitude: z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num >= -180 && num <= 180;
        },
        { message: "Longitude must be between -180 and 180" }
      )
      .optional(),
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  });

export const selectGroupSchema = baseSelectSchema;

export type Group = z.infer<typeof selectGroupSchema>;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type UpdateGroup = z.infer<typeof updateGroupSchema>;
