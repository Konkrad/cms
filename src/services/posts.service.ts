import { db } from '~/db/connection';
import { posts, users, type Post, type NewPost } from '~/db/schema';
import { eq, desc } from 'drizzle-orm';

export type PostWithUser = Post & { user: { displayName: string; email: string } };

export const postsService = {
  async getAll(userId?: string): Promise<PostWithUser[]> {
    let query = db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        userId: posts.userId,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt));

    if (userId) {
      query = query.where(eq(posts.userId, userId)) as any;
    }

    return await query;
  },

  async getRecent(limit: number = 3): Promise<PostWithUser[]> {
    return await db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        userId: posts.userId,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .orderBy(desc(posts.createdAt))
      .limit(limit);
  },

  async getById(id: string): Promise<PostWithUser | undefined> {
    const result = await db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        userId: posts.userId,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        user: {
          displayName: users.displayName,
          email: users.email,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.userId, users.id))
      .where(eq(posts.id, id))
      .limit(1);

    return result[0];
  },

  async create(data: Omit<NewPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<Post> {
    const result = await db.insert(posts).values(data).returning();
    return result[0];
  },

  async update(id: string, data: Partial<Omit<NewPost, 'id' | 'createdAt'>>): Promise<Post | undefined> {
    const result = await db
      .update(posts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();
    return result[0];
  },

  async delete(id: string): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  },
};
