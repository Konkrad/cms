import crypto from "crypto";
import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { scopes, users } from "~/core/schema";

export const events = sqliteTable("events", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	body: text("body").notNull(),
	startDate: text("start_date").notNull(),
	endDate: text("end_date").notNull(),

	locationType: text("location_type").notNull(),
	address: text("address"),
	city: text("city"),
	country: text("country"),
	longitude: text("longitude"),
	latitude: text("latitude"),
	onlineUrl: text("online_url"),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	// Owning scope; null = the root (site-wide).
	scopeId: text("scope_id").references(() => scopes.id),
	visibility: text("visibility", { enum: ["group-only", "global"] })
		.notNull()
		.default("global"),
	image1: text("image1"),
	image2: text("image2"),
	deletedAt: text("deleted_at"),
	deletedBy: text("deleted_by").references(() => users.id),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

const baseInsertSchema = createInsertSchema(events);
const baseSelectSchema = createSelectSchema(events);

export const insertEventSchema = baseInsertSchema
	.extend({
		id: z
			.string()
			.uuid()
			.default(() => crypto.randomUUIDv7()),
		startDate: z.coerce.date().transform((d) => d.toISOString()),
		endDate: z.coerce.date().transform((d) => d.toISOString()),

		createdAt: z.string().default(() => new Date().toISOString()),
		updatedAt: z.string().default(() => new Date().toISOString()),
	})
	.partial({
		id: true,

		createdAt: true,
		updatedAt: true,
	});

export const updateEventSchema = baseInsertSchema
	.omit({
		id: true,
		createdAt: true,
	})
	.partial()
	.extend({
		startDate: z.coerce
			.date()
			.transform((d) => d.toISOString())
			.optional(),
		endDate: z.coerce
			.date()
			.transform((d) => d.toISOString())
			.optional(),

		updatedAt: z
			.string()
			.default(() => new Date().toISOString())
			.optional(),
	});

export const selectEventSchema = baseSelectSchema;

export type Event = z.infer<typeof selectEventSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
