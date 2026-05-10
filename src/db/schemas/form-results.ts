import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/_relations";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export type SurveyResultJson = Record<string, any>;

export const formResults = sqliteTable(
  "form_results",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id),
    userId: text("user_id").references(() => users.id),
    resultJson: text("result_json", { mode: "json" })
      .$type<SurveyResultJson>()
      .notNull(),
    altchaPayload: text("altcha_payload"),
    submittedAt: text("submitted_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    formIdx: index("form_results_form_idx").on(table.formId, table.submittedAt),
    userIdx: index("form_results_user_idx").on(table.userId, table.submittedAt),
    onePerUserUnique: uniqueIndex("form_results_form_user_unique").on(
      table.formId,
      table.userId,
    ),
  }),
);

export const formResultsRelations = relations(formResults, ({ one }) => ({
  form: one(forms, {
    fields: [formResults.formId],
    references: [forms.id],
  }),
  user: one(users, {
    fields: [formResults.userId],
    references: [users.id],
  }),
}));

import { forms } from "./forms";
import { users } from "./users";

const baseInsertSchema = createInsertSchema(formResults);
const baseSelectSchema = createSelectSchema(formResults);

export const insertFormResultSchema = baseInsertSchema
  .extend({
    id: z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),
    submittedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({
    id: true,
    userId: true,
    altchaPayload: true,
    submittedAt: true,
  });

export const selectFormResultSchema = baseSelectSchema;

export type FormResult = z.infer<typeof selectFormResultSchema>;
export type InsertFormResult = z.infer<typeof insertFormResultSchema>;
