import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { scopes } from "../../scopes/schema/scopes";

/**
 * A note or article that was public and published and no longer is (spec 5.3): deleted, or
 * made members-only or representatives-only. Feeds that already handed it out (the social web
 * outbox) show a `Tombstone` in its place instead of silently dropping it. Written only by the
 * notes and articles services; removed again when the item is public and published once more.
 *
 * `ref` is the item's reference (`core:note:<id>`, `core:article:<id>`); `publishedAt` is when
 * the item was first published, so the outbox keeps its place.
 */
export const contentTombstones = sqliteTable(
	"content_tombstones",
	{
		ref: text("ref").primaryKey(),
		type: text("type", { enum: ["note", "article"] }).notNull(),
		itemId: text("item_id").notNull(),
		scopeId: text("scope_id")
			.notNull()
			.references(() => scopes.id, { onDelete: "cascade" }),
		publishedAt: text("published_at").notNull(),
		deletedAt: text("deleted_at").notNull(),
	},
	(table) => [index("content_tombstones_deleted_at_idx").on(table.deletedAt)],
);

export type ContentTombstone = typeof contentTombstones.$inferSelect;
