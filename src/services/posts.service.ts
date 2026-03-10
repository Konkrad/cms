import { desc, eq, lt, isNull, and, or, inArray, sql } from "drizzle-orm";
import { db } from "~/db/connection";
import type { InsertPost, UpdatePost, Post } from "~/db/schemas/posts";
import { posts, insertPostSchema, updatePostSchema } from "~/db/schemas/posts";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";
import { groupMembershipsService } from "~/services/group-memberships.service";

export type PostWithUser = Post & {
  user: User;
};

import type { User } from "~/db/schemas/users";

export const postsService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: PostWithUser[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);

    const results = await db.query.posts.findMany({
      with: {
        user: true,
      },
      orderBy: [desc(posts.createdAt), desc(posts.id)],
      limit: limit + 1,
      where: and(
        isNull(posts.deletedAt),
        cursorObj?.createdAt
          ? lt(posts.createdAt, cursorObj.createdAt)
          : undefined
      ),
    });

    let nextCursor: string | undefined | null = undefined;
    let items = results;
    if (results.length > limit) {
      nextCursor = getNextCursorFromRows(results, ["createdAt"], limit);
      items = results.slice(0, limit);
    }

    return {
      items: items as PostWithUser[],
      nextCursor: nextCursor ?? null,
    };
  },

  async getRecent(limit: number = 3): Promise<PostWithUser[]> {
    const res = await this.getAll(limit);
    return res.items;
  },

  async getPage(
    page: number,
    perPage: number = 10,
  ): Promise<{ items: PostWithUser[]; totalPages: number }> {
    const pageIndex = Math.max(0, page);
    const safePerPage = Math.max(1, perPage);

    const totalResult = await db
      .select({ total: sql<number>`count(*)` })
      .from(posts)
      .where(isNull(posts.deletedAt));

    const total = Number(totalResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / safePerPage);

    const items = await db.query.posts.findMany({
      with: {
        user: true,
      },
      where: isNull(posts.deletedAt),
      orderBy: [desc(posts.createdAt), desc(posts.id)],
      limit: safePerPage,
      offset: pageIndex * safePerPage,
    });

    return {
      items: items as PostWithUser[],
      totalPages,
    };
  },

  async getById(id: string): Promise<PostWithUser | undefined> {
    const result = await db.query.posts.findFirst({
      where: and(eq(posts.id, id), isNull(posts.deletedAt)),
      with: {
        user: true,
      },
    });

    return result as PostWithUser | undefined;
  },

  async getVisiblePosts(
    userId: string | null,
    limit: number = 10,
    cursor?: string | null
  ): Promise<{ items: PostWithUser[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);
    
    let visibilityCondition;
    if (userId) {
      const userGroups = await groupMembershipsService.getUserGroups(userId);
      const groupIds = userGroups.map((g) => g.id);
      
      visibilityCondition = or(
        eq(posts.visibility, "global"),
        and(
          eq(posts.visibility, "group-only"),
          groupIds.length > 0 ? inArray(posts.groupId, groupIds) : undefined
        )
      );
    } else {
      visibilityCondition = eq(posts.visibility, "global");
    }

    const results = await db.query.posts.findMany({
      with: {
        user: true,
      },
      orderBy: [desc(posts.createdAt), desc(posts.id)],
      limit: limit + 1,
      where: and(
        isNull(posts.deletedAt),
        visibilityCondition,
        cursorObj?.createdAt
          ? lt(posts.createdAt, cursorObj.createdAt)
          : undefined
      ),
    });

    let nextCursor: string | undefined | null = undefined;
    let items = results;
    if (results.length > limit) {
      nextCursor = getNextCursorFromRows(results, ["createdAt"], limit);
      items = results.slice(0, limit);
    }

    return {
      items: items as PostWithUser[],
      nextCursor: nextCursor ?? null,
    };
  },

  async create(data: InsertPost): Promise<Post> {
    const parsed = await insertPostSchema.parseAsync(data);

    const [result] = await db
      .insert(posts)
      .values(parsed as any)
      .returning();

    return result;
  },

  async update(id: string, data: UpdatePost): Promise<Post | undefined> {
    const parsed = await updatePostSchema.parseAsync(data);

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
