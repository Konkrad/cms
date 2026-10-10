import crypto from "crypto";
import { type InferSelectModel, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "~/core-api/db-schema";
import { qualificationTypes } from "./qualification-types";

export const qualificationTokens = sqliteTable("qualification_tokens", {
	id: text("id").primaryKey(),
	token: text("token").notNull().unique(),
	typeId: text("type_id")
		.notNull()
		.references(() => qualificationTypes.id),
	createdBy: text("created_by")
		.notNull()
		.references(() => users.id),
	expiresAt: text("expires_at").notNull(),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(qualificationTokens);

export const insertQualificationTokenSchema = baseInsertSchema.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUID()),
	token: z.string().default(() => crypto.randomBytes(32).toString("hex")),
	createdAt: z.string().default(() => new Date().toISOString()),
});

export type QualificationToken = InferSelectModel<typeof qualificationTokens>;
export type InsertQualificationToken = z.infer<
	typeof insertQualificationTokenSchema
>;
