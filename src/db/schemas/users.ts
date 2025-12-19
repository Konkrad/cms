import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	familyName: text("family_name").notNull(),
	displayName: text("display_name").notNull(),

	loginId: text("login_id"),
	city: text("city"),
	country: text("country"),
	longitude: text("longitude"),
	latitude: text("latitude"),
	yearOfBirth: integer("year_of_birth"),
	sex: text("sex"),
	role: text("role", { enum: ["user", "moderator", "admin"] })
		.notNull()
		.default("user"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export type User = z.infer<typeof selectUserSchema>;
export type NewUser = z.infer<typeof insertUserSchema>;
