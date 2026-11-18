import { eq, inArray } from "drizzle-orm";
import type { StreamType } from "~/core/content/content-items";
import {
	type ContentTombstone,
	contentTombstones,
} from "~/core/content/schema/tombstones";
import { db } from "~/core/db/connection";

export type { ContentTombstone };

/** What the tombstone rule looks at on a note or article. */
interface TombstoneItem {
	id: string;
	scopeId: string;
	visibility: string;
	publishedAt: string | null;
}

/** Whether an item is in the public feeds: public and published (approved, spec 4.9). */
export const isPubliclyListed = (
	item: Pick<TombstoneItem, "visibility" | "publishedAt"> | null | undefined,
): boolean => !!item && item.visibility === "public" && !!item.publishedAt;

export const contentRef = (type: StreamType, id: string) =>
	`core:${type}:${id}`;

/**
 * Tombstones of notes and articles that left the public feeds (spec 5.3, `content_tombstones`).
 * Written only by the notes and articles services; read by the public feed. Server-only.
 */
export const tombstonesService = {
	/**
	 * Keeps the tombstone of one item in line with a change from `before` to `after` (null =
	 * did not exist / deleted): an item that was public and published and no longer is gets a
	 * tombstone (deleted, made members-only or representatives-only); an item that is public and
	 * published loses its tombstone (it is back in the feeds at its old place).
	 */
	async sync(
		type: StreamType,
		before: TombstoneItem | null | undefined,
		after: TombstoneItem | null | undefined,
		now = new Date().toISOString(),
	): Promise<void> {
		const item = after ?? before;
		if (!item) return;
		const ref = contentRef(type, item.id);
		if (isPubliclyListed(after)) {
			await db.delete(contentTombstones).where(eq(contentTombstones.ref, ref));
			return;
		}
		if (!before || !isPubliclyListed(before)) return;
		const row = {
			ref,
			type,
			itemId: item.id,
			scopeId: before.scopeId,
			publishedAt: before.publishedAt as string,
			deletedAt: now,
		};
		await db
			.insert(contentTombstones)
			.values(row)
			.onConflictDoUpdate({
				target: contentTombstones.ref,
				set: { publishedAt: row.publishedAt, deletedAt: row.deletedAt },
			});
	},

	async get(type: StreamType, id: string): Promise<ContentTombstone | null> {
		const [row] = await db
			.select()
			.from(contentTombstones)
			.where(eq(contentTombstones.ref, contentRef(type, id)));
		return row ?? null;
	},

	async byRefs(refs: readonly string[]): Promise<ContentTombstone[]> {
		if (!refs.length) return [];
		return db
			.select()
			.from(contentTombstones)
			.where(inArray(contentTombstones.ref, [...refs]));
	},
};
