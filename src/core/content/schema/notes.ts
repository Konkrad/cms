import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { scopes } from "../../scopes/schema/scopes";
import { VISIBILITIES } from "../../scopes/visibility";
import { users } from "../../users/schema";

/**
 * A note (spec 4.4): a short stream item without a title or image, like a status update
 * ("Doors open at 18:00"). The body is short rich text with links only, at most
 * `NOTE_MAX_LENGTH` characters of text, sanitized on write by the notes service.
 *
 * The optional subject links the note to an item it is about, as a reference: `subjectType`
 * is `<module>:<type>` (`events:event`), `subjectId` the item's id (spec 4.3).
 *
 * `publishedAt` is null while a note is not published (reviews, spec 4.9); listings show
 * published notes only. `updatedAt` feeds sitemaps and feed caching.
 */
export const notes = sqliteTable(
	"notes",
	{
		id: text("id").primaryKey(),
		// Owning scope (site-wide = the root).
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id),
		subjectType: text("subject_type"),
		subjectId: text("subject_id"),
		body: text("body").notNull(),
		visibility: text("visibility", { enum: VISIBILITIES })
			.notNull()
			.default("public"),
		authorId: text("author_id")
			.notNull()
			.references(() => users.id),
		publishedAt: text("published_at"),
		updatedAt: text("updated_at").notNull(),
	},
	(table) => [
		index("notes_subject_idx").on(table.subjectType, table.subjectId),
		index("notes_published_at_idx").on(table.publishedAt),
	],
);

export type Note = typeof notes.$inferSelect;
