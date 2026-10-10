import {
	and,
	desc,
	eq,
	inArray,
	isNull,
	like,
	lt,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { sanitizeRichHtml } from "~/core/content/sanitize-html";
import type { InsertPost, Post, UpdatePost } from "~/core/content/schema/posts";
import {
	insertPostSchema,
	posts,
	updatePostSchema,
} from "~/core/content/schema/posts";
import { db } from "~/core/db/connection";
import { groupMembershipsService } from "~/core/scopes/group-memberships.service";
import { groupRepresentativesService } from "~/core/scopes/group-representatives.service";
import {
	decodeCursor,
	getNextCursorFromRows,
	type PageDirection,
	paginateRows,
} from "~/core/shared/pagination";
import {
	type PublicUser,
	publicUserColumns,
	publicUserSelect,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users as usersTable } from "~/core/users/schema";

export type PostWithUser = Post & {
	user: PublicUser;
};

/** Group ids whose group-only posts the viewer may see (their groups); none for guests. */
async function viewerGroupIds(viewerId: string | null): Promise<string[]> {
	if (!viewerId) return [];
	const groups = await groupMembershipsService.getUserGroups(viewerId);
	return groups.map((g) => g.id);
}

/** RQB `where` part: global posts, plus group-only posts of the given groups. */
function visibleWhere(groupIds: string[]) {
	return groupIds.length > 0
		? {
				OR: [
					{ visibility: "global" as const },
					{ visibility: "group-only" as const, groupId: { in: groupIds } },
				],
			}
		: { visibility: "global" as const };
}

/** SQL counterpart of `visibleWhere` for core select queries. */
function visibleSql(groupIds: string[]): SQL | undefined {
	return groupIds.length > 0
		? or(
				eq(posts.visibility, "global"),
				and(
					eq(posts.visibility, "group-only"),
					inArray(posts.groupId, groupIds),
				),
			)
		: eq(posts.visibility, "global");
}

export const postsService = {
	/**
	 * Whether a viewer may see a post: global posts are public; group-only posts are for
	 * members and representatives of the post's group, and platform admins.
	 */
	async canView(
		post: { visibility: string; groupId: string | null },
		viewer: { id: string; role?: string | null } | null,
	): Promise<boolean> {
		if (post.visibility !== "group-only") return true;
		if (!viewer) return false;
		if (viewer.role === "admin") return true;
		if (!post.groupId) return false;
		const [isMember, isRep] = await Promise.all([
			groupMembershipsService.isMember(viewer.id, post.groupId),
			groupRepresentativesService.isRepresentative(viewer.id, post.groupId),
		]);
		return isMember || isRep;
	},

	/** Posts visible to `viewerId` (null = guest: global posts only), newest first. */
	async getAll(
		viewerId: string | null,
		limit: number = 10,
		cursor?: string | null,
		direction: PageDirection = "forward",
	): Promise<{
		items: PostWithUser[];
		nextCursor: string | null;
		prevCursor: string | null;
	}> {
		const cursorObj = decodeCursor(cursor ?? null);
		const groupIds = await viewerGroupIds(viewerId);

		const results = await db.query.posts.findMany({
			with: {
				user: { columns: publicUserColumns },
			},
			orderBy:
				direction === "forward"
					? { createdAt: "desc", id: "desc" }
					: { createdAt: "asc", id: "asc" },
			limit: limit + 1,
			where: {
				deletedAt: { isNull: true },
				...visibleWhere(groupIds),
				...(cursorObj?.createdAt
					? direction === "forward"
						? { createdAt: { lt: cursorObj.createdAt } }
						: { createdAt: { gte: cursorObj.createdAt } }
					: {}),
			},
		});

		return paginateRows(
			results as PostWithUser[],
			["createdAt"],
			limit,
			direction,
			cursor ?? null,
		);
	},

	/** Admin post list (title search, optional group filter) with the author's name. */
	async adminList({
		groupId,
		search,
		limit,
		offset,
	}: {
		groupId: string | null;
		search: string;
		limit: number;
		offset: number;
	}) {
		const where = and(
			isNull(posts.deletedAt),
			groupId ? eq(posts.groupId, groupId) : undefined,
			search ? like(posts.title, `%${search}%`) : undefined,
		);
		const [countRows, rows] = await Promise.all([
			db.select({ total: sql<number>`COUNT(*)` }).from(posts).where(where),
			db
				.select({
					id: posts.id,
					title: posts.title,
					body: posts.body,
					createdAt: posts.createdAt,
					userName: usersTable.name,
					userFamilyName: usersTable.familyName,
				})
				.from(posts)
				.leftJoin(usersTable, eq(posts.userId, usersTable.id))
				.where(where)
				.orderBy(desc(posts.createdAt))
				.limit(limit)
				.offset(offset),
		]);
		return {
			total: Number(countRows[0]?.total ?? 0),
			items: rows.map((r) => ({
				id: r.id,
				title: r.title,
				body: r.body,
				createdAt: r.createdAt,
				user: { name: r.userName ?? "", familyName: r.userFamilyName ?? "" },
			})),
		};
	},

	async getRecent(
		viewerId: string | null,
		limit: number = 3,
	): Promise<PostWithUser[]> {
		const res = await this.getAll(viewerId, limit);
		return res.items;
	},

	/** One archive page of the posts visible to `viewerId` (null = guest). */
	async getPage(
		viewerId: string | null,
		page: number,
		perPage: number = 10,
	): Promise<{ items: PostWithUser[]; totalPages: number }> {
		const pageIndex = Math.max(0, page);
		const safePerPage = Math.max(1, perPage);
		const groupIds = await viewerGroupIds(viewerId);

		const totalResult = await db
			.select({ total: sql<number>`count(*)` })
			.from(posts)
			.where(and(isNull(posts.deletedAt), visibleSql(groupIds)));

		const total = Number(totalResult[0]?.total ?? 0);
		const totalPages = Math.ceil(total / safePerPage);

		const items = await db.query.posts.findMany({
			with: {
				user: { columns: publicUserColumns },
			},
			where: {
				deletedAt: { isNull: true },
				...visibleWhere(groupIds),
			},
			orderBy: { createdAt: "desc", id: "desc" },
			limit: safePerPage,
			offset: pageIndex * safePerPage,
		});

		return {
			items: items as PostWithUser[],
			totalPages,
		};
	},

	/**
	 * A post with its author's public identity and thumbnail. Does NOT check visibility:
	 * public pages must call `canView` before showing it.
	 */
	async getById(
		id: string,
	): Promise<
		| (Post & { user: PublicUser & { profilePictureSmallUrl: string | null } })
		| undefined
	> {
		const result = await db.query.posts.findFirst({
			where: {
				id,
				deletedAt: { isNull: true },
			},
			with: {
				user: {
					columns: {
						...publicUserColumns,
						profilePicture: true,
						profilePictureSmall: true,
					},
				},
			},
		});
		if (!result?.user) return undefined;
		const { profilePicture, profilePictureSmall, ...user } = result.user;
		return {
			...result,
			user: {
				...user,
				profilePictureSmallUrl: publicUserThumbnailUrl({
					profilePicture,
					profilePictureSmall,
				}),
			},
		};
	},

	/**
	 * Latest posts of a group. Group-only posts are included only when the caller has
	 * decided the viewer may see them (member, representative or admin).
	 */
	async getRecentByGroup(
		groupId: string,
		limit: number,
		{ includeGroupOnly }: { includeGroupOnly: boolean },
	): Promise<PostWithUser[]> {
		const rows = await db.query.posts.findMany({
			with: { user: { columns: publicUserColumns } },
			where: {
				groupId,
				deletedAt: { isNull: true },
				...(includeGroupOnly ? {} : { visibility: "global" }),
			},
			orderBy: { createdAt: "desc" },
			limit,
		});
		return rows as PostWithUser[];
	},

	async getVisiblePosts(
		userId: string | null,
		limit: number = 10,
		cursor?: string | null,
	): Promise<{ items: PostWithUser[]; nextCursor?: string | null }> {
		const cursorObj = decodeCursor(cursor ?? null);

		const visibilityCondition = visibleSql(await viewerGroupIds(userId));

		const results = await db
			.select({ post: posts, user: publicUserSelect })
			.from(posts)
			.innerJoin(usersTable, eq(posts.userId, usersTable.id))
			.where(
				and(
					isNull(posts.deletedAt),
					visibilityCondition,
					cursorObj?.createdAt
						? lt(posts.createdAt, cursorObj.createdAt)
						: undefined,
				),
			)
			.orderBy(desc(posts.createdAt), desc(posts.id))
			.limit(limit + 1);

		let nextCursor: string | undefined | null;
		let items = results;
		if (results.length > limit) {
			nextCursor = getNextCursorFromRows(
				results.map((r) => r.post),
				["createdAt"],
				limit,
			);
			items = results.slice(0, limit);
		}

		return {
			items: items.map((row) => ({
				...row.post,
				user: row.user,
			})) as PostWithUser[],
			nextCursor: nextCursor ?? null,
		};
	},

	async create(data: InsertPost): Promise<Post> {
		const parsed = await insertPostSchema.parseAsync(data);

		// body is BlockNote HTML rendered later with dangerouslySetInnerHTML — sanitize on write.
		if (typeof parsed.body === "string") {
			parsed.body = sanitizeRichHtml(parsed.body);
		}

		const [result] = await db
			.insert(posts)
			.values(parsed as any)
			.returning();

		return result;
	},

	async update(id: string, data: UpdatePost): Promise<Post | undefined> {
		const parsed = await updatePostSchema.parseAsync(data);

		if (typeof parsed.body === "string") {
			parsed.body = sanitizeRichHtml(parsed.body);
		}

		const [result] = await db
			.update(posts)
			.set(parsed as any)
			.where(eq(posts.id, id))
			.returning();

		return result;
	},

	async delete(id: string): Promise<void> {
		await db.delete(posts).where(eq(posts.id, id));
	},

	async softDelete(id: string, deletedBy: string): Promise<Post | undefined> {
		const [result] = await db
			.update(posts)
			.set({
				deletedAt: new Date().toISOString(),
				deletedBy,
			})
			.where(eq(posts.id, id))
			.returning();

		return result;
	},
};
