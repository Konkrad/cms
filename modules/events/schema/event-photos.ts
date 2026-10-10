import crypto from "crypto";
import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "~/core/schema";
import { events } from "./events";

export const eventPhotos = sqliteTable(
	"event_photos",
	{
		id: text("id").primaryKey(),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		filePath: text("file_path").notNull(),
		uploadedBy: text("uploaded_by")
			.notNull()
			.references(() => users.id),
		uploadedAt: text("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => ({
		eventIdIdx: index("event_photos_event_id_idx").on(table.eventId),
	}),
);

const baseInsertSchema = createInsertSchema(eventPhotos);
const baseSelectSchema = createSelectSchema(eventPhotos);

export const insertEventPhotoSchema = baseInsertSchema
	.extend({
		id: z
			.string()
			.uuid()
			.default(() => crypto.randomUUID()),
		filePath: z.string().startsWith("private/events/"),
		uploadedAt: z.string().default(() => new Date().toISOString()),
	})
	.partial({ id: true, uploadedAt: true });

export const selectEventPhotoSchema = baseSelectSchema;

export type EventPhoto = z.infer<typeof selectEventPhotoSchema>;
export type InsertEventPhoto = z.infer<typeof insertEventPhotoSchema>;
