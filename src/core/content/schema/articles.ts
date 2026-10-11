import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { scopes } from "../../scopes/schema/scopes";
import { VISIBILITIES } from "../../scopes/visibility";
import { users } from "../../users/schema";

/**
 * An article (spec 4.4): long form with a required title, an optional featured image and a
 * full rich-text body, sanitized on write by the articles service.
 *
 * `featuredImage` is a public S3 key (`public/articles/…`, validated by the service) shown
 * through `publicImageUrlFromKey`. The optional subject links the article to an item it is
 * about (`subjectType` = `<module>:<type>`, `subjectId` = the item's id; spec 4.3).
 *
 * `publishedAt` is null while an article is not published (reviews, spec 4.9).
 */
export const articles = sqliteTable(
	"articles",
	{
		id: text("id").primaryKey(),
		// Owning scope (site-wide = the root).
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id),
		subjectType: text("subject_type"),
		subjectId: text("subject_id"),
		title: text("title").notNull(),
		featuredImage: text("featured_image"),
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
		index("articles_subject_idx").on(table.subjectType, table.subjectId),
		index("articles_published_at_idx").on(table.publishedAt),
	],
);

export type Article = typeof articles.$inferSelect;
