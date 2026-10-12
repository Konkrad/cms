import crypto from "crypto";
import { sql } from "drizzle-orm";
import {
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { scopes, users, VISIBILITIES } from "~/core/schema";

export const EVENT_STATUSES = ["draft", "in_review", "published"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const events = sqliteTable(
	"events",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		// URL segment under the owning scope (`/germany/berlin/events/<slug>`), unique per scope.
		// Generated from the title on create (`eventsService.create`); events created before
		// slugs existed have their id as slug.
		slug: text("slug").notNull(),
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
		// Owning scope (site-wide = the root).
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id),
		visibility: text("visibility", { enum: VISIBILITIES })
			.notNull()
			.default("public"),
		// Review (spec 4.9, 5.2): a chapter's public event is a draft until its proposal is
		// approved; draft and in-review events are hidden publicly.
		status: text("status", { enum: EVENT_STATUSES })
			.notNull()
			.default("published"),
		// Post an announcement note about the event when its proposal is approved.
		announceOnApproval: integer("announce_on_approval", { mode: "boolean" })
			.notNull()
			.default(true),
		// The announcement note, once posted (so a retried handler posts it once).
		announcementNoteId: text("announcement_note_id"),
		// Debrief (spec 5.2): when the organiser was asked for it, and reminded once.
		debriefRequestedAt: text("debrief_requested_at"),
		debriefRemindedAt: text("debrief_reminded_at"),
		image1: text("image1"),
		image2: text("image2"),
		deletedAt: text("deleted_at"),
		deletedBy: text("deleted_by").references(() => users.id),
		createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("events_scope_slug_unique").on(table.scopeId, table.slug),
	],
);

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
		slug: true,
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
