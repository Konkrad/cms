import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import crypto from "crypto";

export type ConsentStep =
  | "profile"
  | "locationVerification"
  | "foodPreference"
  | "lastProfileUpdate"
  | "photoConsent";

export type UserConsent = Partial<Record<ConsentStep, string | null>>;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  familyName: text("family_name").notNull(),

  loginId: text("login_id"),
  city: text("city"),
  country: text("country"),
  longitude: text("longitude"),
  latitude: text("latitude"),
  yearOfBirth: integer("year_of_birth"),
  sex: text("sex"),
  foodPreference: text("food_preference"),
  photoConsentGiven: integer("photo_consent_given", { mode: "boolean" }),
  profilePicture: text("profile_picture"),
  consent: text("consent", { mode: "json" }).$type<UserConsent>().notNull().default(sql`'{}'`),
  role: text("role", { enum: ["user", "moderator", "admin"] })
    .notNull()
    .default("user"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  events: many(events),
  sessions: many(sessions),
}));

// Import for relations - placed after table definition to avoid circular dependency issues
import { posts } from "./posts";
import { events } from "./events";
import { sessions } from "./sessions";

const baseInsertSchema = createInsertSchema(users);
const baseSelectSchema = createSelectSchema(users);

export const insertUserSchema = baseInsertSchema
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
    role: true,
  });

export const updateUserSchema = baseInsertSchema
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

export const selectUserSchema = baseSelectSchema;

export type User = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
