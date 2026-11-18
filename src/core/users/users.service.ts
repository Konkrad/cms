import { eq, inArray, sql } from "drizzle-orm";
import { db } from "~/core/db/connection";
import type { InsertUser, UpdateUser, User } from "~/core/db/schema";
import {
	insertUserSchema,
	logins,
	updateUserSchema,
	users,
} from "~/core/db/schema";
import {
	type PublicUser,
	publicUserColumns,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";

export const usersService = {
	/**
	 * The full users row, private fields included (location, birth year, role,
	 * private S3 keys). Server-side logic and the user's own data only; never hand it
	 * to a page about another user — use `getPublicProfile` for that.
	 */
	async getPrivateById(id: string): Promise<User | undefined> {
		return db.query.users.findFirst({ where: { id } });
	},

	/** Another user's public profile card: name, public thumbnail and city/country. */
	async getPublicProfile(id: string): Promise<
		| (PublicUser & {
				city: string | null;
				country: string | null;
				profilePictureSmallUrl: string | null;
		  })
		| undefined
	> {
		const row = await db.query.users.findFirst({
			where: { id },
			columns: {
				...publicUserColumns,
				city: true,
				country: true,
				profilePicture: true,
				profilePictureSmall: true,
			},
		});
		if (!row) return undefined;
		const { profilePicture, profilePictureSmall, ...rest } = row;
		return {
			...rest,
			profilePictureSmallUrl: publicUserThumbnailUrl({
				profilePicture,
				profilePictureSmall,
			}),
		};
	},

	/**
	 * Name search for pickers (any logged-in member): public identity and thumbnail only,
	 * never emails, so the directory cannot be harvested.
	 */
	async searchPublic(
		query: string,
		limit: number,
	): Promise<Array<PublicUser & { profilePictureSmallUrl: string | null }>> {
		const likePattern = `%${query.toLowerCase()}%`;
		const rows = await db
			.select({
				id: users.id,
				name: users.name,
				familyName: users.familyName,
				profilePicture: users.profilePicture,
				profilePictureSmall: users.profilePictureSmall,
			})
			.from(users)
			.where(
				sql`lower(${users.name} || ' ' || ${users.familyName}) like ${likePattern}`,
			)
			.limit(limit);
		return rows.map(({ profilePicture, profilePictureSmall, ...user }) => ({
			...user,
			profilePictureSmallUrl: publicUserThumbnailUrl({
				profilePicture,
				profilePictureSmall,
			}),
		}));
	},

	/** The user's OWN private details for their own profile page (login email, birth year, sex). */
	async getOwnPrivateDetails(id: string): Promise<{
		email: string | null;
		yearOfBirth: number | null;
		sex: string | null;
	} | null> {
		const [row] = await db
			.select({
				email: logins.email,
				yearOfBirth: users.yearOfBirth,
				sex: users.sex,
			})
			.from(users)
			.leftJoin(logins, eq(logins.id, users.loginId))
			.where(eq(users.id, id));
		return row ?? null;
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
		const parsed = updateUserSchema.parse(data) as UpdateUser;

		// Profile-picture keys are stored verbatim and later presigned server-side, so a
		// client-supplied key outside the profile-picture prefixes would grant a read URL
		// for an arbitrary private object. Drop keys that don't match the upload prefixes.
		if (
			typeof parsed.profilePicture === "string" &&
			!parsed.profilePicture.startsWith("private/profile-pictures/")
		) {
			delete parsed.profilePicture;
		}
		if (
			typeof parsed.profilePictureSmall === "string" &&
			!parsed.profilePictureSmall.startsWith("public/profile-pictures/")
		) {
			delete parsed.profilePictureSmall;
		}

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

	/** Resolves a login email to the user's public identity (admin lookups by email). */
	async getByEmail(email: string): Promise<PublicUser | undefined> {
		// Find a login row for the email, then resolve the user by loginId
		const loginRows = await db
			.select()
			.from(logins)
			.where(eq(logins.email, email));
		if (loginRows.length === 0) return undefined;
		const login = loginRows[0] as any;
		const result = await db.query.users.findFirst({
			where: { loginId: login.id },
			columns: publicUserColumns,
		});

		return result;
	},
};
