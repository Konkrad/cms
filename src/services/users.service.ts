import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "~/db/connection";
import type { NewUser, User } from "~/db/schema";
import { users } from "~/db/schema";

/**
 * Replaced Supabase-backed users service with Drizzle (SQLite) based implementation.
 * Note: `email` is no longer stored on the users table; the canonical email is on the
 * 'logins' row. If you need to create a user that references a login row, provide
 * `loginId` in the create payload.
 */
export const usersService = {
	async getAll(): Promise<User[]> {
		const rows = await db.select().from(users);
		// Ensure a deterministic order (old behavior returned created_at ascending)
		rows.sort(
			(a: any, b: any) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);
		return rows as User[];
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
