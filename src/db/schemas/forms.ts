import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export type SurveyJson = Record<string, any>;

export const forms = sqliteTable(
  "forms",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    schemaJson: text("schema_json", { mode: "json" }).$type<SurveyJson>().notNull(),
    visibility: text("visibility", { enum: ["private", "public"] })
      .notNull()
      .default("private"),
    scopeType: text("scope_type", { enum: ["global", "group"] })
      .notNull()
      .default("global"),
    scopeId: text("scope_id").references(() => groups.id),
    isSystemForm: integer("is_system_form", { mode: "boolean" })
      .notNull()
      .default(false),
    allowResubmission: integer("allow_resubmission", { mode: "boolean" })
      .notNull()
      .default(false),
    systemKey: text("system_key"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    scopeIdx: index("forms_scope_idx").on(table.scopeType, table.scopeId),
    systemKeyUnique: uniqueIndex("forms_system_key_unique").on(table.systemKey),
  }),
);

export const formsRelations = relations(forms, ({ one, many }) => ({
  group: one(groups, {
    fields: [forms.scopeId],
    references: [groups.id],
  }),
  creator: one(users, {
    fields: [forms.createdBy],
    references: [users.id],
  }),
  results: many(formResults),
}));

import { groups } from "./groups";
import { users } from "./users";
import { formResults } from "./form-results";

const baseInsertSchema = createInsertSchema(forms);
const baseSelectSchema = createSelectSchema(forms);

export const insertFormSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    title: z.string().min(1, "Title is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9_-]+$/, "Slug must contain only lowercase letters, numbers, '_' and '-'."),
    createdAt: z.string().default(() => new Date().toISOString()),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    description: true,
    scopeId: true,
    isSystemForm: true,
    systemKey: true,
    createdAt: true,
    updatedAt: true,
  });

export const updateFormSchema = baseInsertSchema
  .omit({
    id: true,
    createdBy: true,
    createdAt: true,
  })
  .partial()
  .extend({
    updatedAt: z
      .string()
      .default(() => new Date().toISOString())
      .optional(),
  });

export const selectFormSchema = baseSelectSchema;

export type Form = z.infer<typeof selectFormSchema>;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type UpdateForm = z.infer<typeof updateFormSchema>;
