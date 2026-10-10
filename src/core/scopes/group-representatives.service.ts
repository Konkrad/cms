import { and, eq } from "drizzle-orm";
import { db } from "~/core/db/connection";
import {
	type GroupRepresentative,
	groupRepresentatives,
	insertGroupRepresentativeSchema,
} from "~/core/db/schema";
import {
	type PublicUser,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users } from "~/core/users/schema";

export type RepresentativeWithUser = GroupRepresentative & {
	user: PublicUser & { profilePictureSmallUrl: string | null };
};

export const groupRepresentativesService = {
	async isRepresentative(userId: string, groupId: string): Promise<boolean> {
		const results = await db
			.select()
			.from(groupRepresentatives)
			.where(
				and(
					eq(groupRepresentatives.userId, userId),
					eq(groupRepresentatives.groupId, groupId),
				),
			)
			.limit(1);
		return results.length > 0;
	},

	async isRepresentativeOfAny(userId: string): Promise<boolean> {
		const results = await db
			.select({ id: groupRepresentatives.id })
			.from(groupRepresentatives)
			.where(eq(groupRepresentatives.userId, userId))
			.limit(1);
		return results.length > 0;
	},

	async promote(
		userId: string,
		groupId: string,
		promotedBy: string,
	): Promise<GroupRepresentative> {
		const validated = await insertGroupRepresentativeSchema.parseAsync({
			userId,
			groupId,
			promotedBy,
		});
		const [representative] = await db
			.insert(groupRepresentatives)
			.values(validated as any)
			.returning();
		return representative;
	},

	async getRepresentatives(groupId: string): Promise<GroupRepresentative[]> {
		return await db
			.select()
			.from(groupRepresentatives)
			.where(eq(groupRepresentatives.groupId, groupId));
	},

	async getFirstRepresentativeWithUser(
		groupId: string,
	): Promise<RepresentativeWithUser | null> {
		const results = await db
			.select({
				id: groupRepresentatives.id,
				userId: groupRepresentatives.userId,
				groupId: groupRepresentatives.groupId,
				promotedAt: groupRepresentatives.promotedAt,
				promotedBy: groupRepresentatives.promotedBy,
				user: {
					id: users.id,
					name: users.name,
					familyName: users.familyName,
					profilePicture: users.profilePicture,
					profilePictureSmall: users.profilePictureSmall,
				},
			})
			.from(groupRepresentatives)
			.innerJoin(users, eq(groupRepresentatives.userId, users.id))
			.where(eq(groupRepresentatives.groupId, groupId))
			.limit(1);
		const row = results[0];
		if (!row) return null;
		const { profilePicture, profilePictureSmall, ...user } = row.user;
		return {
			...row,
			user: {
				...user,
				profilePictureSmallUrl: publicUserThumbnailUrl({
					profilePicture,
					profilePictureSmall,
				}),
			},
		};
	},
};
