import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { events } from "./events";
import { users } from "./users";
import crypto from "crypto";

export const eventPhotos = sqliteTable("event_photos", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => users.id),
  uploadedAt: text("uploaded_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  thumbnailPath: text("thumbnail_path"),
}, (table) => ({
  eventIdIdx: index("event_photos_event_id_idx").on(table.eventId),
}));

export const eventPhotosRelations = relations(eventPhotos, ({ one }) => ({
  event: one(events, {
    fields: [eventPhotos.eventId],
    references: [events.id],
  }),
  uploader: one(users, {
    fields: [eventPhotos.uploadedBy],
    references: [users.id],
  }),
}));

const baseInsertSchema = createInsertSchema(eventPhotos);
const baseSelectSchema = createSelectSchema(eventPhotos);

export const insertEventPhotoSchema = baseInsertSchema
  .extend({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    filePath: z.string().startsWith("/private/events/"),
    uploadedAt: z.string().default(() => new Date().toISOString()),
  })
  .partial({ id: true, thumbnailPath: true, uploadedAt: true });

export const selectEventPhotoSchema = baseSelectSchema;

export type EventPhoto = z.infer<typeof selectEventPhotoSchema>;
export type InsertEventPhoto = z.infer<typeof insertEventPhotoSchema>;
