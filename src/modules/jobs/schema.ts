import crypto from "crypto";
import { type InferSelectModel, sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { defineModuleSchema, scopes, users } from "~/core/schema";

export const jobs = sqliteTable("jobs", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	body: text("body").notNull(),
	editorState: text("editor_state"),
	locationType: text("location_type", {
		enum: ["on-site", "remote-eu", "remote-country"],
	}).notNull(),
	city: text("city"),
	country: text("country"),
	link: text("link"),
	posterRelation: text("poster_relation", {
		enum: ["hiring", "founder", "direct-team", "works-there", "other"],
	}),
	expiresAt: text("expires_at").notNull(),
	status: text("status", {
		enum: ["pending", "approved"],
	})
		.notNull()
		.default("pending"),
	suggestedBy: text("suggested_by")
		.notNull()
		.references(() => users.id),
	// Owning scope (spec 4.2: every scoped content row has one; site-wide = the root).
	scopeId: text("scope_id")
		.notNull()
		.references(() => scopes.id, { onDelete: "cascade" }),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(jobs);

export const insertJobSchema = baseInsertSchema.extend({
	id: z
		.string()
		.uuid()
		.default(() => crypto.randomUUIDv7()),
	expiresAt: z.coerce.date().transform((d) => d.toISOString()),
	createdAt: z.string().default(() => new Date().toISOString()),
	updatedAt: z.string().default(() => new Date().toISOString()),
});

// updatedAt is handled by the service, not included in input
export const updateJobSchema = baseInsertSchema
	.omit({ id: true, scopeId: true, createdAt: true, updatedAt: true })
	.partial()
	.extend({
		expiresAt: z.coerce
			.date()
			.transform((d) => d.toISOString())
			.optional(),
	});

export default defineModuleSchema({
	tables: { jobs },
	relations: (r) => ({
		jobs: {
			user: r.one.users({
				from: r.jobs.suggestedBy,
				to: r.users.id,
				optional: false,
			}),
		},
		users: {
			jobs: r.many.jobs({ from: r.users.id, to: r.jobs.suggestedBy }),
		},
	}),
});

export type Job = InferSelectModel<typeof jobs>;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type UpdateJob = z.infer<typeof updateJobSchema>;
