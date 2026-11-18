import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	isNotNull,
	lt,
	type SQL,
	sql,
} from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import {
	type ArticleWithAuthor,
	articlesService,
} from "~/core/content/articles.service";
import { canViewStreamItem } from "~/core/content/content-input";
import { STREAM_TYPES, type StreamType } from "~/core/content/content-items";
import {
	type NoteWithAuthor,
	notesService,
} from "~/core/content/notes.service";
import { articles } from "~/core/content/schema/articles";
import { notes } from "~/core/content/schema/notes";
import { db } from "~/core/db/connection";
import type { ContentFilter } from "~/core/scopes/content-filter";
import {
	decodeCursor,
	type PageDirection,
	paginateRows,
} from "~/core/shared/pagination";

/** One item of the stream: a note or an article (with its public author), tagged by `type`. */
export type StreamRow =
	| (NoteWithAuthor & { type: "note" })
	| (ArticleWithAuthor & { type: "article" });

/** Which types a listing shows (default: both). */
export interface StreamOptions {
	types?: readonly StreamType[];
}

const TABLES = { note: notes, article: articles } as const;

type Table = (typeof TABLES)[StreamType];
type Head = { type: StreamType; id: string; publishedAt: string };

function heads(
	types: readonly StreamType[],
	where: (table: Table) => SQL | undefined,
) {
	const selects = (types.length ? types : STREAM_TYPES).map((type) => {
		const table = TABLES[type];
		return db
			.select({
				type: sql<StreamType>`${type}`.as("type"),
				id: table.id,
				publishedAt: sql<string>`${table.publishedAt}`.as("published_at"),
			})
			.from(table)
			.where(and(isNotNull(table.publishedAt), where(table)));
	});
	const [first, second] = selects;
	return second ? unionAll(first, second) : first;
}

const newestFirst = [desc(sql`published_at`), desc(sql`id`)];
const oldestFirst = [asc(sql`published_at`), asc(sql`id`)];

/** The rows for these heads, in the heads' order (items deleted meanwhile are left out). */
async function hydrate(list: readonly Head[]): Promise<StreamRow[]> {
	const ids = (type: StreamType) =>
		list.filter((h) => h.type === type).map((h) => h.id);
	const [noteRows, articleRows] = await Promise.all([
		notesService.byIds(ids("note")),
		articlesService.byIds(ids("article")),
	]);
	const byKey = new Map<string, StreamRow>([
		...noteRows.map((n) => [`note:${n.id}`, { ...n, type: "note" }] as const),
		...articleRows.map(
			(a) => [`article:${a.id}`, { ...a, type: "article" }] as const,
		),
	]);
	return list.flatMap((h) => byKey.get(`${h.type}:${h.id}`) ?? []);
}

/**
 * The stream (spec 4.4): published notes and articles in one list, newest first. Every
 * listing that may show both (news block, scope home, related items, archives, updates about
 * an item) reads them here; `types` narrows it to one type. Server-only.
 */
export const stream = {
	/**
	 * A cursor page of a listing (`scopeContentFilter`: viewer and listing scope). Cursors key on
	 * `publishedAt` like the other cursor listings.
	 */
	async list(
		filter: ContentFilter,
		options: StreamOptions & {
			limit?: number;
			cursor?: string | null;
			direction?: PageDirection;
		} = {},
	): Promise<{
		items: StreamRow[];
		nextCursor: string | null;
		prevCursor: string | null;
	}> {
		const limit = options.limit ?? 10;
		const direction = options.direction ?? "forward";
		const cursor = decodeCursor(options.cursor ?? null);
		const at = cursor?.publishedAt as string | undefined;
		const rows = (await heads(options.types ?? STREAM_TYPES, (t) =>
			and(
				filter.where(t),
				at
					? direction === "forward"
						? lt(t.publishedAt, at)
						: gte(t.publishedAt, at)
					: undefined,
			),
		)
			.orderBy(...(direction === "forward" ? newestFirst : oldestFirst))
			.limit(limit + 1)) as Head[];
		const page = paginateRows(
			rows,
			["publishedAt"],
			limit,
			direction,
			options.cursor ?? null,
		);
		return { ...page, items: await hydrate(page.items) };
	},

	/** The newest items of a listing. */
	async recent(
		filter: ContentFilter,
		limit = 3,
		options: StreamOptions = {},
	): Promise<StreamRow[]> {
		return (await this.list(filter, { ...options, limit })).items;
	},

	/** One numbered page (0-based) of a listing, and how many pages it has (archives). */
	async page(
		filter: ContentFilter,
		page: number,
		perPage = 10,
		options: StreamOptions = {},
	): Promise<{ items: StreamRow[]; totalPages: number }> {
		const types = options.types?.length ? options.types : STREAM_TYPES;
		const safePerPage = Math.max(1, perPage);
		const counts = await Promise.all(
			types.map(async (type) => {
				const t = TABLES[type];
				const [row] = await db
					.select({ total: count() })
					.from(t)
					.where(and(isNotNull(t.publishedAt), filter.where(t)));
				return Number(row?.total ?? 0);
			}),
		);
		const total = counts.reduce((a, b) => a + b, 0);
		const rows = (await heads(types, (t) => filter.where(t))
			.orderBy(...newestFirst)
			.limit(safePerPage)
			.offset(Math.max(0, page) * safePerPage)) as Head[];
		return {
			items: await hydrate(rows),
			totalPages: Math.ceil(total / safePerPage),
		};
	},

	/**
	 * The published notes and articles about one item (`<subjectType>:<subjectId>`) this viewer
	 * may see, newest first. Whatever scope an item belongs to, its own visibility decides.
	 */
	async forSubject(
		subjectType: string,
		subjectId: string,
		viewer: { id: string } | null,
		options: StreamOptions & { limit?: number } = {},
	): Promise<StreamRow[]> {
		const rows = await hydrate(
			(await heads(options.types ?? STREAM_TYPES, (t) =>
				and(eq(t.subjectType, subjectType), eq(t.subjectId, subjectId)),
			)
				.orderBy(...newestFirst)
				.limit(options.limit ?? 50)) as Head[],
		);
		const visible = await Promise.all(
			rows.map((row) => canViewStreamItem(row, viewer)),
		);
		return rows.filter((_, i) => visible[i]);
	},

	/** Every note and article about one item, published or not, newest first (its admin page). */
	async listForSubject(
		subjectType: string,
		subjectId: string,
	): Promise<StreamRow[]> {
		const [noteRows, articleRows] = await Promise.all([
			notesService.listForSubject(subjectType, subjectId),
			articlesService.listForSubject(subjectType, subjectId),
		]);
		const rows: StreamRow[] = [
			...noteRows.map((n) => ({ ...n, type: "note" as const })),
			...articleRows.map((a) => ({ ...a, type: "article" as const })),
		];
		const key = (r: StreamRow) => r.publishedAt ?? r.updatedAt;
		return rows.sort((a, b) => key(b).localeCompare(key(a)));
	},
};
