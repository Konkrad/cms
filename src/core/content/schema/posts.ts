import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { scopes } from "../../scopes/schema/scopes";
import { VISIBILITIES } from "../../scopes/visibility";
import { users } from "../../users/schema";

/**
 * A post (spec 4.4): one type for short notes and long articles. A post without a title is
 * shown as a note, one with a title as an article (`postKind`). The body is HTML of any
 * length, sanitized on write by the posts service.
 *
 * The optional subject links the post to an item it is about, as a reference: `subjectType`
 * is `<module>:<type>` (`events:event`), `subjectId` the item's id, so the reference is
 * `<subjectType>:<subjectId>` (spec 4.3). Modules show the posts about their items
 * (`posts.forSubject`) instead of keeping update tables of their own.
 *
 * `publishedAt` is null while a post is not published (reviews, spec 4.9); listings show
 * published posts only. `updatedAt` feeds sitemaps, `dateModified` and feed caching.
 */
export const posts = sqliteTable(
	"posts",
	{
		id: text("id").primaryKey(),
		// Owning scope (site-wide = the root).
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id),
		subjectType: text("subject_type"),
		subjectId: text("subject_id"),
		title: text("title"),
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
		index("posts_subject_idx").on(table.subjectType, table.subjectId),
		index("posts_published_at_idx").on(table.publishedAt),
	],
);

export type Post = typeof posts.$inferSelect;
