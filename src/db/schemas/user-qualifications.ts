import { sql, type InferSelectModel } from "drizzle-orm";
import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";
import { users } from "./users";
import { qualificationTypes } from "./qualification-types";

export const userQualifications = sqliteTable(
  "user_qualifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    typeId: text("type_id")
      .notNull()
      .references(() => qualificationTypes.id),
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    })
      .notNull()
      .default("pending"),
    notes: text("notes"),
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: text("verified_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [unique().on(t.userId, t.typeId)],
);

const baseInsertSchema = createInsertSchema(userQualifications);

export const insertUserQualificationSchema = baseInsertSchema.extend({
  id: z
    .string()
    .uuid()
    .default(() => crypto.randomUUID()),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateUserQualificationSchema = baseInsertSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type UserQualification = InferSelectModel<typeof userQualifications>;
export type InsertUserQualification = z.infer<typeof insertUserQualificationSchema>;
export type UpdateUserQualification = z.infer<typeof updateUserQualificationSchema>;
