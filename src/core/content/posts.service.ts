import { and, desc, eq, inArray, isNotNull, like, or, sql } from "drizzle-orm";
import {
	normalizePostTitle,
	PostInputError,
	postExcerpt,
	toPlainText,
} from "~/core/content/posts";
import { sanitizeRichHtml } from "~/core/content/sanitize-html";
import { type Post, posts } from "~/core/content/schema/posts";
import { db } from "~/core/db/connection";
import { parseRef } from "~/core/refs/refs";
import { internalLinksToRefs, resolveRef } from "~/core/registry/refs";
import {
	allowedVisibilities,
	canViewScope,
	getScope,
} from "~/core/scopes/access";
import type { ContentFilter } from "~/core/scopes/content-filter";
import { VISIBILITIES, type Visibility } from "~/core/scopes/visibility";
import {
	decodeCursor,
	type PageDirection,
	paginateRows,
} from "~/core/shared/pagination";
import {
	type PublicUser,
	publicUserColumns,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users as usersTable } from "~/core/users/schema";

export type { Post };

/** A post with its author's public identity (never the users row). */
export type PostWithAuthor = Post & { author: PublicUser };

/** What a caller may set on a post. The body is HTML; core sanitizes it on write. */
export interface PostInput {
	/** Owning scope (site-wide = the root). */
	scopeId: string;
	/** Empty or missing = a note; a title makes the post an article. */
	title?: string | null;
	body: string;
	visibility: Visibility;
	/**
	 * What the post is about, as a reference: `<module>:<type>` (`events:event`) plus the item
	 * id. Both or neither. The item must exist and its module must be active.
	 */
	subjectType?: string | null;
	subjectId?: string | null;
}

export { PostInputError };

const SUBJECT_TYPE_RE = /^[a-z][a-z0-9-]{0,39}:[a-z][a-z0-9-]{0,39}$/;
const MAX_TITLE = 200;

/** Published posts only; unpublished ones (reviews, spec 4.9) are for the admin. */
const published = isNotNull(posts.publishedAt);

/**
 * The subject columns for an input, or throws when the subject does not resolve: malformed,
 * an unknown or inactive module or type, or an item that is gone (`resolveRef` is null).
 */
export async function validatePostSubject(
	subjectType: string | null | undefined,
	subjectId: string | null | undefined,
): Promise<{ subjectType: string | null; subjectId: string | null }> {
	const type = subjectType?.trim() || null;
	const id = subjectId?.trim() || null;
	if (!type && !id) return { subjectType: null, subjectId: null };
	if (!type || !id)
		throw new PostInputError("A subject needs both a type and an id");
	if (!SUBJECT_TYPE_RE.test(type) || !parseRef(`${type}:${id}`))
		throw new PostInputError(`Invalid subject: ${type}:${id}`);
	if ((await resolveRef(`${type}:${id}`)) === null)
		throw new PostInputError(
			`The subject ${type}:${id} does not exist or its module is not active`,
		);
	return { subjectType: type, subjectId: id };
}

/** Sanitized body for storage; throws when nothing is left to show. */
async function cleanBody(body: string): Promise<string> {
	// Rendered with dangerouslySetInnerHTML: links to site pages become references first.
	const clean = sanitizeRichHtml(await internalLinksToRefs(body));
	if (!toPlainText(clean)) throw new PostInputError("The post is empty");
	return clean;
}

function cleanTitle(title: string | null | undefined): string | null {
	const clean = normalizePostTitle(title);
	if (clean && clean.length > MAX_TITLE)
		throw new PostInputError(
			`The title is longer than ${MAX_TITLE} characters`,
		);
	return clean;
}

async function checkVisibility(
	authorId: string,
	scopeId: string,
	visibility: Visibility,
): Promise<void> {
	if (!VISIBILITIES.includes(visibility))
		throw new PostInputError(`Unknown visibility: ${visibility}`);
	if (
		!(await allowedVisibilities({ id: authorId }, scopeId)).includes(visibility)
	)
		throw new PostInputError("You cannot publish with this visibility");
}

const withAuthor = { author: { columns: publicUserColumns } } as const;

export const postsService = {
	/**
	 * Whether a viewer may see a post: public posts are for everyone, members-only ones for
	 * members of the post's scope (or a scope below it) and role holders on it,
	 * representatives-only ones for role holders. Unpublished posts are for no public viewer.
	 */
	async canView(
		post: { visibility: string; scopeId: string; publishedAt: string | null },
		viewer: { id: string } | null,
	): Promise<boolean> {
		if (!post.publishedAt) return false;
		if (post.visibility === "public") return true;
		return canViewScope(viewer, post.scopeId, post.visibility as Visibility);
	},

	/** The posts a listing shows (`scopeContentFilter`: viewer and listing scope), newest first. */
	async getAll(
		filter: ContentFilter,
		limit: number = 10,
		cursor?: string | null,
		direction: PageDirection = "forward",
		options: { articlesOnly?: boolean } = {},
	): Promise<{
		items: PostWithAuthor[];
		nextCursor: string | null;
		prevCursor: string | null;
	}> {
		const cursorObj = decodeCursor(cursor ?? null);
		const results = await db.query.posts.findMany({
			with: withAuthor,
			orderBy:
				direction === "forward"
					? { publishedAt: "desc", id: "desc" }
					: { publishedAt: "asc", id: "asc" },
			limit: limit + 1,
			where: {
				publishedAt: { isNotNull: true },
				...(options.articlesOnly ? { title: { isNotNull: true } } : {}),
				RAW: (t) => filter.where(t),
				...(cursorObj?.publishedAt
					? direction === "forward"
						? { publishedAt: { lt: cursorObj.publishedAt } }
						: { publishedAt: { gte: cursorObj.publishedAt } }
					: {}),
			},
		});
		return paginateRows(
			results as PostWithAuthor[],
			["publishedAt"],
			limit,
			direction,
			cursor ?? null,
		);
	},

	async getRecent(
		filter: ContentFilter,
		limit: number = 3,
	): Promise<PostWithAuthor[]> {
		return (await this.getAll(filter, limit)).items;
	},

	/** One archive page of the posts a listing shows (`scopeContentFilter`). */
	async getPage(
		filter: ContentFilter,
		page: number,
		perPage: number = 10,
	): Promise<{ items: PostWithAuthor[]; totalPages: number }> {
		const pageIndex = Math.max(0, page);
		const safePerPage = Math.max(1, perPage);
		const [totalRow] = await db
			.select({ total: sql<number>`count(*)` })
			.from(posts)
			.where(and(published, filter.where(posts)));
		const totalPages = Math.ceil(Number(totalRow?.total ?? 0) / safePerPage);
		const items = await db.query.posts.findMany({
			with: withAuthor,
			where: {
				publishedAt: { isNotNull: true },
				RAW: (t) => filter.where(t),
			},
			orderBy: { publishedAt: "desc", id: "desc" },
			limit: safePerPage,
			offset: pageIndex * safePerPage,
		});
		return { items: items as PostWithAuthor[], totalPages };
	},

	/**
	 * The published posts about one item (`<subjectType>:<subjectId>`) this viewer may see,
	 * newest first, with public authors. Whatever scope a post belongs to, its own visibility
	 * decides (`canView`).
	 */
	async forSubject(
		subjectType: string,
		subjectId: string,
		viewer: { id: string } | null,
		limit = 50,
	): Promise<PostWithAuthor[]> {
		const rows = (await db.query.posts.findMany({
			with: withAuthor,
			where: {
				subjectType,
				subjectId,
				publishedAt: { isNotNull: true },
			},
			orderBy: { publishedAt: "desc", id: "desc" },
			limit,
		})) as PostWithAuthor[];
		const visible = await Promise.all(
			rows.map((post) => this.canView(post, viewer)),
		);
		return rows.filter((_, i) => visible[i]);
	},

	/** Every post about one item, published or not, newest first (the item's admin page). */
	async listForSubject(
		subjectType: string,
		subjectId: string,
	): Promise<PostWithAuthor[]> {
		return (await db.query.posts.findMany({
			with: withAuthor,
			where: { subjectType, subjectId },
			orderBy: { publishedAt: "desc", id: "desc" },
		})) as PostWithAuthor[];
	},

	/** Admin post list (title/body search; `scopeIds` limits it to those scopes, null = all). */
	async adminList({
		scopeIds,
		search,
		limit,
		offset,
	}: {
		scopeIds: string[] | null;
		search: string;
		limit: number;
		offset: number;
	}) {
		const where = and(
			scopeIds ? inArray(posts.scopeId, scopeIds) : undefined,
			search
				? or(like(posts.title, `%${search}%`), like(posts.body, `%${search}%`))
				: undefined,
		);
		const [countRows, rows] = await Promise.all([
			db.select({ total: sql<number>`COUNT(*)` }).from(posts).where(where),
			db
				.select({
					id: posts.id,
					title: posts.title,
					body: posts.body,
					visibility: posts.visibility,
					subjectType: posts.subjectType,
					subjectId: posts.subjectId,
					publishedAt: posts.publishedAt,
					updatedAt: posts.updatedAt,
					authorName: usersTable.name,
					authorFamilyName: usersTable.familyName,
				})
				.from(posts)
				.leftJoin(usersTable, eq(posts.authorId, usersTable.id))
				.where(where)
				.orderBy(desc(posts.publishedAt), desc(posts.updatedAt))
				.limit(limit)
				.offset(offset),
		]);
		return {
			total: Number(countRows[0]?.total ?? 0),
			items: rows.map(({ authorName, authorFamilyName, body, ...r }) => ({
				...r,
				excerpt: postExcerpt(body, 100),
				author: { name: authorName ?? "", familyName: authorFamilyName ?? "" },
			})),
		};
	},

	/**
	 * A post with its author's public identity and thumbnail. Does NOT check visibility:
	 * public pages must call `canView` before showing it.
	 */
	async getById(id: string): Promise<
		| (Post & {
				author: PublicUser & { profilePictureSmallUrl: string | null };
		  })
		| undefined
	> {
		const result = await db.query.posts.findFirst({
			where: { id },
			with: {
				author: {
					columns: {
						...publicUserColumns,
						profilePicture: true,
						profilePictureSmall: true,
					},
				},
			},
		});
		if (!result?.author) return undefined;
		const { profilePicture, profilePictureSmall, ...author } = result.author;
		return {
			...result,
			author: {
				...author,
				profilePictureSmallUrl: publicUserThumbnailUrl({
					profilePicture,
					profilePictureSmall,
				}),
			},
		};
	},

	/** Owning scope and label of the posts with these ids (reference resolution). */
	async locate(
		ids: readonly string[],
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		if (!ids.length) return [];
		const rows = await db
			.select({
				id: posts.id,
				scopeId: posts.scopeId,
				title: posts.title,
				body: posts.body,
			})
			.from(posts)
			.where(inArray(posts.id, [...ids]));
		return rows.map((r) => ({
			id: r.id,
			scopeId: r.scopeId,
			title: r.title ?? postExcerpt(r.body, 60),
		}));
	},

	/** Published public posts whose title or text contains `query`, newest first (link picker). */
	async searchPublic(
		query: string,
		limit: number,
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		const rows = await db
			.select({
				id: posts.id,
				scopeId: posts.scopeId,
				title: posts.title,
				body: posts.body,
			})
			.from(posts)
			.where(
				and(
					published,
					eq(posts.visibility, "public"),
					or(like(posts.title, `%${query}%`), like(posts.body, `%${query}%`)),
				),
			)
			.orderBy(desc(posts.publishedAt))
			.limit(limit);
		return rows.map((r) => ({
			id: r.id,
			scopeId: r.scopeId,
			title: r.title ?? postExcerpt(r.body, 60),
		}));
	},

	/**
	 * Creates and publishes a post by `authorId`. Validates what the caller cannot be trusted
	 * with: the scope exists, the author may use the visibility on it (`allowedVisibilities`),
	 * the subject resolves; sanitizes the body. Throws `PostInputError` otherwise. Callers
	 * authorize first (the author's right to post in the scope, e.g. `requireScopeRole`).
	 */
	async create(input: PostInput & { authorId: string }): Promise<Post> {
		if (!(await getScope(input.scopeId)))
			throw new PostInputError("Unknown scope");
		await checkVisibility(input.authorId, input.scopeId, input.visibility);
		const subject = await validatePostSubject(
			input.subjectType,
			input.subjectId,
		);
		const now = new Date().toISOString();
		const [row] = await db
			.insert(posts)
			.values({
				id: crypto.randomUUID(),
				scopeId: input.scopeId,
				...subject,
				title: cleanTitle(input.title),
				body: await cleanBody(input.body),
				visibility: input.visibility,
				authorId: input.authorId,
				publishedAt: now,
				updatedAt: now,
			})
			.returning();
		return row;
	},

	/**
	 * Updates title, body, visibility and subject (whitelisted; scope and author never change).
	 * `editorId` is checked against the visibility like on create.
	 */
	async update(
		id: string,
		input: Partial<Omit<PostInput, "scopeId">>,
		editorId: string,
	): Promise<Post | undefined> {
		const current = await db.query.posts.findFirst({ where: { id } });
		if (!current) return undefined;
		const changes: Partial<Post> = { updatedAt: new Date().toISOString() };
		if (input.title !== undefined) changes.title = cleanTitle(input.title);
		if (input.body !== undefined) changes.body = await cleanBody(input.body);
		if (
			input.visibility !== undefined &&
			input.visibility !== current.visibility
		) {
			await checkVisibility(editorId, current.scopeId, input.visibility);
			changes.visibility = input.visibility;
		}
		if (input.subjectType !== undefined || input.subjectId !== undefined) {
			const type = input.subjectType?.trim() || null;
			const subjectId = input.subjectId?.trim() || null;
			// An unchanged subject is kept even if it no longer resolves (module deactivated).
			if (type !== current.subjectType || subjectId !== current.subjectId)
				Object.assign(changes, await validatePostSubject(type, subjectId));
		}
		const [row] = await db
			.update(posts)
			.set(changes)
			.where(eq(posts.id, id))
			.returning();
		return row;
	},

	async delete(id: string): Promise<void> {
		await db.delete(posts).where(eq(posts.id, id));
	},
};
