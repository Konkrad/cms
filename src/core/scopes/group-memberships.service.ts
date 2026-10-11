import { and, eq, sql } from "drizzle-orm";
import { logins } from "~/core/auth/schema/logins";
import { db } from "~/core/db/connection";
import {
	type GroupMembership,
	groupMemberships,
	insertGroupMembershipSchema,
} from "~/core/scopes/schema/group-memberships";
import { type Group, groups } from "~/core/scopes/schema/groups";
import {
	type PublicUser,
	publicUserThumbnailUrl,
} from "~/core/users/public-user";
import { users } from "~/core/users/schema";

export const groupMembershipsService = {
	async isMember(userId: string, groupId: string): Promise<boolean> {
		const results = await db
			.select()
			.from(groupMemberships)
			.where(
				and(
					eq(groupMemberships.userId, userId),
					eq(groupMemberships.groupId, groupId),
				),
			)
			.limit(1);
		return results.length > 0;
	},

	async join(userId: string, groupId: string): Promise<GroupMembership> {
		const validated = await insertGroupMembershipSchema.parseAsync({
			userId,
			groupId,
		});
		const [membership] = await db
			.insert(groupMemberships)
			.values(validated as any)
			.returning();
		return membership;
	},

	async getUserGroups(userId: string): Promise<Group[]> {
		const results = await db
			.select({
				id: groups.id,
				name: groups.name,
				slug: groups.slug,
				latitude: groups.latitude,
				longitude: groups.longitude,
				image1: groups.image1,
				image2: groups.image2,
				image3: groups.image3,
				createdAt: groups.createdAt,
				updatedAt: groups.updatedAt,
			})
			.from(groupMemberships)
			.innerJoin(groups, eq(groupMemberships.groupId, groups.id))
			.where(eq(groupMemberships.userId, userId));
		return results;
	},

	/** Some members of a group, as public cards (name and public thumbnail only). */
	async getSomeMembers(
		groupId: string,
		limit: number,
	): Promise<Array<PublicUser & { profilePictureSmallUrl: string | null }>> {
		const rows = await db
			.select({
				id: users.id,
				name: users.name,
				familyName: users.familyName,
				profilePicture: users.profilePicture,
				profilePictureSmall: users.profilePictureSmall,
			})
			.from(groupMemberships)
			.innerJoin(users, eq(groupMemberships.userId, users.id))
			.where(eq(groupMemberships.groupId, groupId))
			.limit(limit);
		return rows.map(({ profilePicture, profilePictureSmall, ...user }) => ({
			...user,
			profilePictureSmallUrl: publicUserThumbnailUrl({
				profilePicture,
				profilePictureSmall,
			}),
		}));
	},

	/**
	 * PRIVATE: a group's members with their login email, for the
	 * global admin members page only. Public pages use `getSomeMembers`.
	 */
	async getMembersWithEmailAndRole(groupId: string) {
		return db
			.select({
				id: users.id,
				name: users.name,
				familyName: users.familyName,
				email: logins.email,
				city: users.city,
				country: users.country,
				joinedAt: groupMemberships.joinedAt,
			})
			.from(groupMemberships)
			.innerJoin(users, eq(groupMemberships.userId, users.id))
			.leftJoin(logins, eq(logins.id, users.loginId))
			.where(eq(groupMemberships.groupId, groupId))
			.orderBy(groupMemberships.joinedAt);
	},

	/** Member count per group id (groups without members are absent). */
	async countAllByGroup(): Promise<Map<string, number>> {
		const rows = await db
			.select({
				groupId: groupMemberships.groupId,
				count: sql<number>`count(*)`.as("count"),
			})
			.from(groupMemberships)
			.groupBy(groupMemberships.groupId);
		return new Map(rows.map((r) => [r.groupId, r.count]));
	},

	async countByGroupId(groupId: string): Promise<number> {
		const results = await db
			.select()
			.from(groupMemberships)
			.where(eq(groupMemberships.groupId, groupId));
		return results.length;
	},

	async getMembership(
		userId: string,
		groupId: string,
	): Promise<GroupMembership | null> {
		const results = await db
			.select()
			.from(groupMemberships)
			.where(
				and(
					eq(groupMemberships.userId, userId),
					eq(groupMemberships.groupId, groupId),
				),
			)
			.limit(1);
		return results[0] || null;
	},
};
