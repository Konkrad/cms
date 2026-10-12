import { createHash } from "node:crypto";
import {
	and,
	count,
	desc,
	eq,
	isNotNull,
	max,
	type SQL,
	sql,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import { articlesService } from "~/core/content/articles.service";
import { STREAM_TYPES, type StreamType } from "~/core/content/content-items";
import { notesService } from "~/core/content/notes.service";
import { articles } from "~/core/content/schema/articles";
import { notes } from "~/core/content/schema/notes";
import { contentTombstones } from "~/core/content/schema/tombstones";
import { type StreamRow, stream } from "~/core/content/stream.service";
import {
	type ContentTombstone,
	contentRef,
	isPubliclyListed,
	tombstonesService,
} from "~/core/content/tombstones.service";
import { db } from "~/core/db/connection";
import {
	type ContentFilter,
	scopeContentFilter,
} from "~/core/scopes/content-filter";

export type { ContentTombstone };

/**
 * One entry of the public activity history (the social web outbox, spec 5.3), newest first:
 * - `create`: an item was published (`at` = its `publishedAt`). `item` is the live item, or
 *   null when it left the public feeds since; then `tombstone` says when.
 * - `delete`: an item left the public feeds (`at` = the tombstone's `deletedAt`).
 */
export interface PublicFeedEntry {
	activity: "create" | "delete";
	type: StreamType;
	id: string;
	at: string;
	item: StreamRow | null;
	tombstone: ContentTombstone | null;
}

/** Validators for HTTP caching of a feed: changes whenever a listed item or tombstone does. */
export interface PublicFeedVersion {
	/** Newest `updatedAt` of a listed item or `deletedAt` of a tombstone (null when empty). */
	lastModified: string | null;
	/** Opaque version tag (no quotes). */
	tag: string;
}

const TABLES = { note: notes, article: articles } as const;
type Table = (typeof TABLES)[StreamType];

/** The anonymous visitor's site-wide listing: public, published items of every scope. */
const guestFilter = (): Promise<ContentFilter> => scopeContentFilter(null);

const publicWhere = (filter: ContentFilter, t: Table): SQL =>
	and(
		isNotNull(t.publishedAt),
		eq(t.visibility, "public"),
		filter.where(t),
	) as SQL;

// Sort key of an entry: `<at>|<c|d>|<type>|<id>`; unique, and its order is the outbox order
// (a delete sorts after a create of the same instant). Cursors are encoded sort keys.
const SEP = "|";
const encodeCursor = (key: string) => Buffer.from(key).toString("base64url");
function decodeCursor(cursor: string): string | null {
	const key = Buffer.from(cursor, "base64url").toString("utf8");
	return /^\d{4}-\d\d-\d\dT[^|]+\|[cd]\|(note|article)\|[^|]+$/.test(key)
		? key
		: null;
}

/**
 * The site's public content for feeds (spec 5.3: RSS, the social web): public, approved
 * (published) notes and articles of the whole site, as an anonymous visitor sees them, plus the
 * tombstones of items that left. Read-only. Server-only.
 */
export const publicFeed = {
	/** The newest public, published items (`types` narrows to notes or articles), newest first. */
	async items(
		options: { types?: readonly StreamType[]; limit?: number } = {},
	): Promise<StreamRow[]> {
		const { items } = await stream.list(await guestFilter(), {
			types: options.types,
			limit: options.limit ?? 50,
		});
		// The guest filter lists public items only; checked again on purpose.
		return items.filter(isPubliclyListed);
	},

	/** Caching validators for a feed of `types` (default both). */
	async version(
		types: readonly StreamType[] = STREAM_TYPES,
	): Promise<PublicFeedVersion> {
		const filter = await guestFilter();
		const parts = await Promise.all(
			types.map(async (type) => {
				const t = TABLES[type];
				const [live] = await db
					.select({ n: count(), newest: max(t.updatedAt) })
					.from(t)
					.where(publicWhere(filter, t));
				const [gone] = await db
					.select({ n: count(), newest: max(contentTombstones.deletedAt) })
					.from(contentTombstones)
					.where(eq(contentTombstones.type, type));
				return [live, gone];
			}),
		);
		const rows = parts.flat();
		const newest = rows
			.map((r) => r?.newest ?? null)
			.filter((v): v is string => !!v)
			.sort()
			.at(-1);
		const tag = createHash("sha1")
			.update(
				[types.join(","), ...rows.map((r) => `${r?.n}:${r?.newest}`)].join(SEP),
			)
			.digest("base64url");
		return { lastModified: newest ?? null, tag };
	},

	/** How many entries `entries` pages through. */
	async totalEntries(): Promise<number> {
		const filter = await guestFilter();
		const counts = await Promise.all([
			...STREAM_TYPES.map(async (type) => {
				const t = TABLES[type];
				const [row] = await db
					.select({ n: count() })
					.from(t)
					.where(publicWhere(filter, t));
				return Number(row?.n ?? 0);
			}),
			db
				.select({ n: count() })
				.from(contentTombstones)
				// Each tombstone is a create (tombstoned in place) and a delete.
				.then(([row]) => 2 * Number(row?.n ?? 0)),
		]);
		return counts.reduce((a, b) => a + b, 0);
	},

	/**
	 * One page of the public activity history, newest first; `cursor` continues after the last
	 * entry of the previous page (`nextCursor`). Returns null for a malformed cursor. Pages are
	 * stable: new entries only ever come before the first page.
	 */
	async entries(
		options: { limit?: number; cursor?: string | null } = {},
	): Promise<{ entries: PublicFeedEntry[]; nextCursor: string | null } | null> {
		const limit = Math.max(1, options.limit ?? 20);
		const after = options.cursor ? decodeCursor(options.cursor) : null;
		if (options.cursor && !after) return null;
		const filter = await guestFilter();
		const key = (
			at: SQL | unknown,
			kind: "c" | "d",
			type: SQL | unknown,
			id: unknown,
		) =>
			sql<string>`${at} || ${`${SEP}${kind}${SEP}`} || ${type} || ${SEP} || ${id}`;
		const before = (k: SQL) => (after ? sql`${k} < ${after}` : undefined);

		const live = STREAM_TYPES.map((type) => {
			const t = TABLES[type];
			const k = key(t.publishedAt, "c", type, t.id);
			return db
				.select({ sortKey: k.as("sort_key") })
				.from(t)
				.where(and(publicWhere(filter, t), before(k)));
		});
		const ts = contentTombstones;
		const created = key(ts.publishedAt, "c", ts.type, ts.itemId);
		const deleted = key(ts.deletedAt, "d", ts.type, ts.itemId);
		const gone = [
			db
				.select({ sortKey: created.as("sort_key") })
				.from(ts)
				.where(before(created)),
			db
				.select({ sortKey: deleted.as("sort_key") })
				.from(ts)
				.where(before(deleted)),
		];
		// One select shape across the tables; drizzle types each table's select apart.
		const [a, b, c, d] = [...live, ...gone] as Array<(typeof live)[number]>;
		const rows = (await unionAll(a, b, c, d)
			.orderBy(desc(sql`sort_key`))
			.limit(limit + 1)) as Array<{ sortKey: string }>;

		const page = rows.slice(0, limit).map(({ sortKey }) => {
			const [at, kind, type, id] = sortKey.split(SEP) as [
				string,
				"c" | "d",
				StreamType,
				string,
			];
			return { at, kind, type, id, sortKey };
		});
		const ids = (type: StreamType) =>
			page.filter((e) => e.type === type).map((e) => e.id);
		const [noteRows, articleRows, tombstones] = await Promise.all([
			notesService.byIds(ids("note")),
			articlesService.byIds(ids("article")),
			tombstonesService.byRefs(page.map((e) => contentRef(e.type, e.id))),
		]);
		const items = new Map<string, StreamRow>([
			...noteRows.map(
				(n) => [`note:${n.id}`, { ...n, type: "note" as const }] as const,
			),
			...articleRows.map(
				(a) => [`article:${a.id}`, { ...a, type: "article" as const }] as const,
			),
		]);
		const graves = new Map(tombstones.map((t) => [t.ref, t]));
		const entries = page.flatMap((e): PublicFeedEntry[] => {
			const tombstone = graves.get(contentRef(e.type, e.id)) ?? null;
			const live = items.get(`${e.type}:${e.id}`);
			const item = !tombstone && live && isPubliclyListed(live) ? live : null;
			// Changed between the two queries: left out rather than shown wrongly.
			if (!item && !tombstone) return [];
			return [
				{
					activity: e.kind === "d" ? "delete" : "create",
					type: e.type,
					id: e.id,
					at: e.at,
					item: e.kind === "d" ? null : item,
					tombstone,
				},
			];
		});
		const last = page.at(-1);
		return {
			entries,
			nextCursor:
				rows.length > limit && last ? encodeCursor(last.sortKey) : null,
		};
	},

	/**
	 * One item as the public feeds show it: the live item while it is public and published, its
	 * tombstone after it left them, or null (never public, unknown, unreviewed).
	 */
	async get(
		type: StreamType,
		id: string,
	): Promise<
		| { item: StreamRow; tombstone: null }
		| { item: null; tombstone: ContentTombstone }
		| null
	> {
		const tombstone = await tombstonesService.get(type, id);
		if (tombstone) return { item: null, tombstone };
		const [row] =
			type === "note"
				? (await notesService.byIds([id])).map((n) => ({
						...n,
						type: "note" as const,
					}))
				: (await articlesService.byIds([id])).map((a) => ({
						...a,
						type: "article" as const,
					}));
		if (!row || !isPubliclyListed(row)) return null;
		const filter = await guestFilter();
		return filter.matches(row) ? { item: row, tombstone: null } : null;
	},
};
