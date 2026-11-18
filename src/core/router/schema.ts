import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Old public URLs (external links, bookmarks) and where they moved (spec 4.3). Written when a
 * scope is moved or its slug changes (one row per scope of the subtree, matched as a path
 * prefix) and when a page's slug changes. Paths have a leading and no trailing slash.
 */
export const redirects = sqliteTable("redirects", {
	fromPath: text("from_path").primaryKey(),
	toPath: text("to_path").notNull(),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
