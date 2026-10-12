import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import {
	canViewStreamItem,
	changedSubject,
	checkVisibility,
	cleanArticleBody,
	requireExistingScope,
	type StreamItemInput,
	validateSubject,
} from "~/core/content/content-input";
import {
	ARTICLE_TITLE_MAX_LENGTH,
	ContentInputError,
	isArticleImageKey,
	textExcerpt,
} from "~/core/content/content-items";
import { type Article, articles } from "~/core/content/schema/articles";
import { db } from "~/core/db/connection";
import {
	type PublicUser,
	publicUserColumns,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users as usersTable } from "~/core/users/schema";

export type { Article };

/** An article with its author's public identity (never the users row). */
export type ArticleWithAuthor = Article & { author: PublicUser };

/** What a caller may set on an article (spec 4.4). */
export interface ArticleInput extends StreamItemInput {
	/** Required. */
	title: string;
	/** A public article image key (`public/articles/…`), or null for none. */
	featuredImage?: string | null;
}

const withAuthor = { author: { columns: publicUserColumns } } as const;

function cleanTitle(title: string | null | undefined): string {
	const clean = (title ?? "").trim();
	if (!clean) throw new ContentInputError("An article needs a title");
	if (clean.length > ARTICLE_TITLE_MAX_LENGTH)
		throw new ContentInputError(
			`The title is longer than ${ARTICLE_TITLE_MAX_LENGTH} characters`,
		);
	return clean;
}

/** A stored image key: empty = none; anything but a public article image key is refused. */
function cleanImage(key: string | null | undefined): string | null {
	const clean = (key ?? "").trim();
	if (!clean) return null;
	if (!isArticleImageKey(clean))
		throw new ContentInputError("Invalid image for an article");
	return clean;
}

/**
 * Articles (spec 4.4): long form with a title, an optional featured image and full rich text.
 * Listings that mix notes and articles go through the stream reader (`stream.service.ts`).
 */
export const articlesService = {
	canView: canViewStreamItem,

	/** Articles by id with public authors, in no particular order (stream hydration). */
	async byIds(ids: readonly string[]): Promise<ArticleWithAuthor[]> {
		if (!ids.length) return [];
		return (await db.query.articles.findMany({
			with: withAuthor,
			where: { id: { in: [...ids] } },
		})) as ArticleWithAuthor[];
	},

	/** Every article about one item, published or not, newest first (the item's admin page). */
	async listForSubject(
		subjectType: string,
		subjectId: string,
	): Promise<ArticleWithAuthor[]> {
		return (await db.query.articles.findMany({
			with: withAuthor,
			where: { subjectType, subjectId },
			orderBy: { publishedAt: "desc", id: "desc" },
		})) as ArticleWithAuthor[];
	},

	/** Admin article list (title/text search; `scopeIds` limits it to those scopes, null = all). */
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
			scopeIds ? inArray(articles.scopeId, scopeIds) : undefined,
			search
				? or(
						like(articles.title, `%${search}%`),
						like(articles.body, `%${search}%`),
					)
				: undefined,
		);
		const [countRows, rows] = await Promise.all([
			db.select({ total: sql<number>`COUNT(*)` }).from(articles).where(where),
			db
				.select({
					id: articles.id,
					title: articles.title,
					body: articles.body,
					featuredImage: articles.featuredImage,
					visibility: articles.visibility,
					subjectType: articles.subjectType,
					subjectId: articles.subjectId,
					publishedAt: articles.publishedAt,
					updatedAt: articles.updatedAt,
					authorName: usersTable.name,
					authorFamilyName: usersTable.familyName,
				})
				.from(articles)
				.leftJoin(usersTable, eq(articles.authorId, usersTable.id))
				.where(where)
				.orderBy(desc(articles.publishedAt), desc(articles.updatedAt))
				.limit(limit)
				.offset(offset),
		]);
		return {
			total: Number(countRows[0]?.total ?? 0),
			items: rows.map(({ authorName, authorFamilyName, body, ...r }) => ({
				...r,
				excerpt: textExcerpt(body, 100),
				author: { name: authorName ?? "", familyName: authorFamilyName ?? "" },
			})),
		};
	},

	/**
	 * An article with its author's public identity and thumbnail. Does NOT check visibility:
	 * public pages must call `canView` before showing it.
	 */
	async getById(id: string): Promise<
		| (Article & {
				author: PublicUser & { profilePictureSmallUrl: string | null };
		  })
		| undefined
	> {
		const result = await db.query.articles.findFirst({
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

	/** Owning scope, title and visibility of the articles with these ids (reference resolution). */
	async locate(
		ids: readonly string[],
	): Promise<
		Array<{ id: string; scopeId: string; title: string; visibility: string }>
	> {
		if (!ids.length) return [];
		return db
			.select({
				id: articles.id,
				scopeId: articles.scopeId,
				title: articles.title,
				visibility: articles.visibility,
			})
			.from(articles)
			.where(inArray(articles.id, [...ids]));
	},

	/** Published public articles whose title or text contains `query`, newest first (link picker). */
	async searchPublic(
		query: string,
		limit: number,
	): Promise<Array<{ id: string; scopeId: string; title: string }>> {
		return db
			.select({
				id: articles.id,
				scopeId: articles.scopeId,
				title: articles.title,
			})
			.from(articles)
			.where(
				and(
					sql`${articles.publishedAt} IS NOT NULL`,
					eq(articles.visibility, "public"),
					or(
						like(articles.title, `%${query}%`),
						like(articles.body, `%${query}%`),
					),
				),
			)
			.orderBy(desc(articles.publishedAt))
			.limit(limit);
	},

	/**
	 * Creates and publishes an article by `authorId`. Validates what the caller cannot be
	 * trusted with: the scope exists, the author may use the visibility on it
	 * (`allowedVisibilities`), the subject resolves, the image is a public article image key;
	 * requires a title and sanitizes the body. Throws `ContentInputError` otherwise. Callers
	 * authorize first (e.g. `requireScopeRole`).
	 */
	async create(input: ArticleInput & { authorId: string }): Promise<Article> {
		await requireExistingScope(input.scopeId);
		const title = cleanTitle(input.title);
		const featuredImage = cleanImage(input.featuredImage);
		await checkVisibility(input.authorId, input.scopeId, input.visibility);
		const subject = await validateSubject(input.subjectType, input.subjectId);
		const now = new Date().toISOString();
		const [row] = await db
			.insert(articles)
			.values({
				id: crypto.randomUUID(),
				scopeId: input.scopeId,
				...subject,
				title,
				featuredImage,
				body: await cleanArticleBody(input.body),
				visibility: input.visibility,
				authorId: input.authorId,
				publishedAt: now,
				updatedAt: now,
			})
			.returning();
		return row;
	},

	/**
	 * Updates title, image, body, visibility and subject (whitelisted; scope and author never
	 * change). `editorId` is checked against a changed visibility like an author on create.
	 */
	async update(
		id: string,
		input: Partial<Omit<ArticleInput, "scopeId">>,
		editorId: string,
	): Promise<Article | undefined> {
		const current = await db.query.articles.findFirst({ where: { id } });
		if (!current) return undefined;
		const changes: Partial<Article> = { updatedAt: new Date().toISOString() };
		if (input.title !== undefined) changes.title = cleanTitle(input.title);
		// An unchanged image is kept (migrated posts may have keys of other prefixes).
		if (
			input.featuredImage !== undefined &&
			(input.featuredImage?.trim() || null) !== current.featuredImage
		)
			changes.featuredImage = cleanImage(input.featuredImage);
		if (input.body !== undefined)
			changes.body = await cleanArticleBody(input.body);
		if (
			input.visibility !== undefined &&
			input.visibility !== current.visibility
		) {
			await checkVisibility(editorId, current.scopeId, input.visibility);
			changes.visibility = input.visibility;
		}
		const subject = await changedSubject(input, current);
		if (subject) Object.assign(changes, subject);
		const [row] = await db
			.update(articles)
			.set(changes)
			.where(eq(articles.id, id))
			.returning();
		return row;
	},

	async delete(id: string): Promise<void> {
		await db.delete(articles).where(eq(articles.id, id));
	},
};
