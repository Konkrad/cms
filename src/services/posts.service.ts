import { db } from "~/db/connection";
import { posts } from "~/db/schemas/posts";
import { users } from "~/db/schemas/users";
import { eq, desc } from "drizzle-orm";
import type { Post, NewPost } from "~/db/schemas/posts";
import type { User } from "~/db/schemas/users";

export type PostWithUser = Post & {
  user: { displayName: string; email: string };
};

export const postsService = {
  async getAll(userId?: string): Promise<PostWithUser[]> {
    let query = db
      .select({
        ...posts,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt));

    if (userId) {
      query = query.where(eq(posts.userId, userId));
    }

    const results = await query;
    return results.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        displayName: row.user?.displayName ?? "",
        email: row.user?.email ?? "",
      },
    }));
  },

  async getRecent(limit: number = 3): Promise<PostWithUser[]> {
    const results = await db
      .select({
        ...posts,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return results.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        displayName: row.user?.displayName ?? "",
        email: row.user?.email ?? "",
      },
    }));
  },

  async getById(id: string): Promise<PostWithUser | undefined> {
    const results = await db
      .select({
        ...posts,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .where(eq(posts.id, id));

    const row = results[0];
    if (!row) return undefined;

    return {
      id: row.id,
      title: row.title,
      body: row.body,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      user: {
        displayName: row.user?.displayName ?? "",
        email: row.user?.email ?? "",
      },
    };
  },

  async create(
    data: Omit<NewPost, "id" | "createdAt" | "updatedAt">,
  ): Promise<Post> {
    const [result] = await db
      .insert(posts)
      .values({
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return result as Post;
  },

  async update(
    id: string,
    data: Partial<Omit<NewPost, "id" | "createdAt">>,
  ): Promise<Post | undefined> {
    const [result] = await db
      .update(posts)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(posts.id, id))
      .returning();

    return result as Post | undefined;
  },

  async delete(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  },
};
