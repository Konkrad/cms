import crypto from "crypto";
import { eq, asc, desc, and, or, gt, lt } from "drizzle-orm";
import { db } from "~/db/connection";
import type { NewUser, User } from "~/db/schema";
import { users } from "~/db/schema";
import {
  decodeCursor,
  getNextCursorFromRows,
  buildKeysetComparisons,
  exampleBuildDrizzleWhere,
} from "~/services/pagination";

/**
 * Replaced Supabase-backed users service with Drizzle (SQLite) based implementation.
 * Note: `email` is no longer stored on the users table; the canonical email is on the
 * 'logins' row. If you need to create a user that references a login row, provide
 * `loginId` in the create payload.
 */
export const usersService = {
  async getAll(options?: {
    limit?: number;
    sortOrder?: "asc" | "desc";
    cursor?: string | null;
  }): Promise<{ items: User[]; nextCursor?: string | null }> {
    // Keyset pagination using (createdAt, id) as the stable ordering columns.
    const cursorObj = decodeCursor(options?.cursor ?? null);
    const chains = buildKeysetComparisons(
      cursorObj,
      ["createdAt", "id"],
      options?.sortOrder ?? "asc",
    );
    const keysetWhere = exampleBuildDrizzleWhere(
      chains,
      (name: string) => (users as any)[name],
      { eq, lt, gt, and, or },
    );

    const order = options?.sortOrder ?? "asc";
    const orderExprs =
      order === "asc"
        ? [asc(users.createdAt), asc(users.id)]
        : [desc(users.createdAt), desc(users.id)];

    let query: any = db
      .select()
      .from(users)
      .where(keysetWhere ?? undefined)
      .orderBy(...(orderExprs as any));

    if (typeof options?.limit === "number" && options.limit > 0) {
      query = (query as any).limit(options.limit + 1);
    }

    const rows = await query;

    let nextCursor: string | undefined | null = undefined;
    let items = rows as any[];
    if (typeof options?.limit === "number" && options.limit > 0) {
      if (rows.length > options.limit) {
        nextCursor = getNextCursorFromRows(
          rows as any[],
          ["createdAt", "id"],
          options.limit,
        );
        items = (rows as any[]).slice(0, options.limit);
      }
    }

    return { items: items as User[], nextCursor: nextCursor ?? null };
  },

  async getById(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    if (!rows || rows.length === 0) return undefined;
    return rows[0] as User;
  },

  async create(
    data: Omit<NewUser, "id" | "createdAt" | "updatedAt"> & {
      loginId?: string;
    },
  ): Promise<User> {
    const id = crypto.randomUUID();
    await db
      .insert(users)
      .values({ id, ...data } as any)
      .run();

    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0] as User;
  },

  async update(
    id: string,
    data: Partial<Omit<NewUser, "id" | "createdAt">>,
  ): Promise<User | undefined> {
    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.name !== undefined) updates.name = data.name;
    if (data.familyName !== undefined) updates.familyName = data.familyName;
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.city !== undefined) updates.city = data.city;
    if (data.country !== undefined) updates.country = data.country;
    if (data.longitude !== undefined) updates.longitude = data.longitude;
    if (data.latitude !== undefined) updates.latitude = data.latitude;
    if (data.yearOfBirth !== undefined) updates.yearOfBirth = data.yearOfBirth;
    if (data.sex !== undefined) updates.sex = data.sex;
    if (data.loginId !== undefined) updates.loginId = data.loginId;

    await db.update(users).set(updates).where(eq(users.id, id)).run();
    return this.getById(id);
  },

  async delete(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  },
};
