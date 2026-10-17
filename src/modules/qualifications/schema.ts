import crypto from "crypto";
import { type InferSelectModel, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { defineModuleSchema, scopes, users } from "~/core/schema";

export const qualificationTypes = sqliteTable("qualification_types", {
	id: text("id").primaryKey(),
	slug: text("slug").notNull().unique(),
	label: text("label").notNull(),
	description: text("description"),
	grantsMembershipTier: text("grants_membership_tier", {
		enum: ["associated", "full"],
	}).notNull(),
	// Owning scope (spec 4.2: every scoped content row has one; site-wide = the root).
	scopeId: text("scope_id")
		.notNull()
		.references(() => scopes.id, { onDelete: "cascade" }),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const qualificationTypeBase = createInsertSchema(qualificationTypes);

export const insertQualificationTypeSchema = qualificationTypeBase.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUID()),
	createdAt: z.string().default(() => new Date().toISOString()),
	updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateQualificationTypeSchema = qualificationTypeBase
	.omit({ id: true, scopeId: true, createdAt: true, updatedAt: true })
	.partial();

export type QualificationType = InferSelectModel<typeof qualificationTypes>;
export type InsertQualificationType = z.infer<
	typeof insertQualificationTypeSchema
>;
export type UpdateQualificationType = z.infer<
	typeof updateQualificationTypeSchema
>;

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

const qualificationTokenBase = createInsertSchema(qualificationTokens);

export const insertQualificationTokenSchema = qualificationTokenBase.extend({
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
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(t) => [unique().on(t.userId, t.typeId)],
);

const userQualificationBase = createInsertSchema(userQualifications);

export const insertUserQualificationSchema = userQualificationBase.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUID()),
	createdAt: z.string().default(() => new Date().toISOString()),
	updatedAt: z.string().default(() => new Date().toISOString()),
});

export const updateUserQualificationSchema = userQualificationBase
	.omit({ id: true, createdAt: true, updatedAt: true })
	.partial();

export type UserQualification = InferSelectModel<typeof userQualifications>;
export type InsertUserQualification = z.infer<
	typeof insertUserQualificationSchema
>;
export type UpdateUserQualification = z.infer<
	typeof updateUserQualificationSchema
>;

export default defineModuleSchema({
	tables: { qualificationTypes, qualificationTokens, userQualifications },
	relations: (r) => ({
		qualificationTypes: {
			qualifications: r.many.userQualifications({
				from: r.qualificationTypes.id,
				to: r.userQualifications.typeId,
			}),
			tokens: r.many.qualificationTokens({
				from: r.qualificationTypes.id,
				to: r.qualificationTokens.typeId,
			}),
		},
		qualificationTokens: {
			type: r.one.qualificationTypes({
				from: r.qualificationTokens.typeId,
				to: r.qualificationTypes.id,
				optional: false,
			}),
			creator: r.one.users({
				from: r.qualificationTokens.createdBy,
				to: r.users.id,
				optional: false,
			}),
		},
		userQualifications: {
			user: r.one.users({
				from: r.userQualifications.userId,
				to: r.users.id,
				optional: false,
			}),
			verifier: r.one.users({
				from: r.userQualifications.verifiedBy,
				to: r.users.id,
			}),
			type: r.one.qualificationTypes({
				from: r.userQualifications.typeId,
				to: r.qualificationTypes.id,
				optional: false,
			}),
		},
		users: {
			qualifications: r.many.userQualifications({
				from: r.users.id,
				to: r.userQualifications.userId,
			}),
		},
	}),
});
