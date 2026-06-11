import { eq, desc, lt, inArray } from "drizzle-orm";
import { db } from "~/db/connection";
import type { InsertUser, UpdateUser, User } from "~/db/schema";
import { users, insertUserSchema, updateUserSchema, logins } from "~/db/schema";
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
      orderBy: { createdAt: "desc", id: "desc" },
      limit: limit + 1,
      where: cursorObj?.createdAt
        ? { createdAt: { lt: cursorObj.createdAt } }
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
      where: { id },
    });

    return result;
  },

  async getByIdWithPosts(id: string): Promise<UserWithPosts | undefined> {
    const result = await db.query.users.findFirst({
      where: { id },
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

  /**
   * Resolve the login email for a set of user ids. Used to look up a participant's
   * real email server-side from their id, so emails never need to be exposed to the
   * browser (see the user-search API / participant linking flow).
   */
  async getEmailsByIds(ids: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (ids.length === 0) return result;

    const rows = await db
      .select({ id: users.id, email: logins.email })
      .from(users)
      .leftJoin(logins, eq(logins.id, users.loginId))
      .where(inArray(users.id, ids));

    for (const row of rows) {
      if (row.email) result.set(row.id, row.email);
    }
    return result;
  },

  async getByEmail(email: string): Promise<User | undefined> {
    // Find a login row for the email, then resolve the user by loginId
    const loginRows = await db.select().from(logins).where(eq(logins.email, email));
    if (loginRows.length === 0) return undefined;
    const login = loginRows[0] as any;
    const result = await db.query.users.findFirst({
      where: { loginId: login.id },
    });

    return result;
  },
};
