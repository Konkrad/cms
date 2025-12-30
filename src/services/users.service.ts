import { eq, desc, lt } from "drizzle-orm";
import { db } from "~/db/connection";
import type { InsertUser, UpdateUser, User } from "~/db/schema";
import { users, insertUserSchema, updateUserSchema } from "~/db/schema";
import { decodeCursor, getNextCursorFromRows } from "~/services/pagination";
import type { Post } from "~/db/schemas/posts";

export type UserWithPosts = User & {
  posts: Post[];
};

export const usersService = {
  async getAll(
    limit: number = 10,
    cursor?: string | null,
  ): Promise<{ items: User[]; nextCursor?: string | null }> {
    const cursorObj = decodeCursor(cursor ?? null);

    const results = await db.query.users.findMany({
      orderBy: [desc(users.createdAt), desc(users.id)],
      limit: limit + 1,
      where: cursorObj?.createdAt
        ? lt(users.createdAt, cursorObj.createdAt)
        : undefined,
    });

    let nextCursor: string | undefined | null = undefined;
    let items = results;
    if (results.length > limit) {
      nextCursor = getNextCursorFromRows(results, ["createdAt"], limit);
      items = results.slice(0, limit);
    }

    return { items, nextCursor: nextCursor ?? null };
  },

  async getById(id: string): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    return result;
  },

  async getByIdWithPosts(id: string): Promise<UserWithPosts | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        posts: true,
      },
    });

    return result as UserWithPosts | undefined;
  },

  async create(
    data: InsertUser & {
      loginId?: string;
    },
  ): Promise<User> {
    const parsed = insertUserSchema.parse(data);
    const [result] = await db
      .insert(users)
      .values(parsed as any)
      .returning();

    return result;
  },

  async update(id: string, data: UpdateUser): Promise<User | undefined> {
    const parsed = updateUserSchema.parse(data);
    const [result] = await db
      .update(users)
      .set(parsed as any)
      .where(eq(users.id, id))
      .returning();

    return result;
  },

  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  },

  async getByEmail(email: string): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    return result;
  },
};
