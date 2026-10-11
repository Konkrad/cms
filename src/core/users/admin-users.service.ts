import {
	and,
	desc,
	eq,
	inArray,
	isNull,
	like,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { logins } from "~/core/auth/schema/logins";
import { sessions } from "~/core/auth/schema/sessions";
import { db } from "~/core/db/connection";
import { userMemberships } from "~/core/memberships/schema";
import { groupMemberships } from "~/core/scopes/schema/group-memberships";
import { scopeRoles, scopes } from "~/core/scopes/schema/scopes";
import { userTagsService } from "~/core/tags/user-tags.service";
import { users } from "~/core/users/schema";

/** Admin user management (`/admin/[group_slug]/users`). */
export const adminUsersService = {
	/**
	 * PRIVATE: users (all, or one group's members) with login email, platform role (their
	 * admin/moderator role on the root scope),
	 * membership tier, tags and last login, for the admin users page only. Searches
	 * name, family name and email.
	 */
	async listWithEmailAndRole({
		groupId,
		search,
		limit,
		offset,
	}: {
		groupId: string | null;
		search: string;
		limit: number;
		offset: number;
	}) {
		const searchWhere = search
			? or(
					like(users.name, `%${search}%`),
					like(users.familyName, `%${search}%`),
					like(logins.email, `%${search}%`),
				)
			: undefined;

		const columns = {
			id: users.id,
			name: users.name,
			familyName: users.familyName,
			email: logins.email,
			city: users.city,
			country: users.country,
			createdAt: users.createdAt,
		};

		let total: number;
		let rows: Array<
			{
				id: string;
				name: string;
				familyName: string;
				email: string | null;
				city: string | null;
				country: string | null;
				createdAt: string;
			} & { joinedAt: string }
		>;

		if (groupId === null) {
			const [countRows, userRows] = await Promise.all([
				db
					.select({ total: sql<number>`COUNT(DISTINCT ${users.id})` })
					.from(users)
					.leftJoin(logins, eq(users.loginId, logins.id))
					.where(searchWhere),
				db
					.select(columns)
					.from(users)
					.leftJoin(logins, eq(users.loginId, logins.id))
					.where(searchWhere)
					.orderBy(desc(users.createdAt))
					.limit(limit)
					.offset(offset),
			]);
			total = Number(countRows[0]?.total ?? 0);
			rows = userRows.map((u) => ({ ...u, joinedAt: u.createdAt }));
		} else {
			const where: SQL | undefined = and(
				eq(groupMemberships.groupId, groupId),
				searchWhere,
			);
			const [countRows, memberRows] = await Promise.all([
				db
					.select({ total: sql<number>`COUNT(*)` })
					.from(groupMemberships)
					.innerJoin(users, eq(groupMemberships.userId, users.id))
					.leftJoin(logins, eq(users.loginId, logins.id))
					.where(where),
				db
					.select({ ...columns, joinedAt: groupMemberships.joinedAt })
					.from(groupMemberships)
					.innerJoin(users, eq(groupMemberships.userId, users.id))
					.leftJoin(logins, eq(users.loginId, logins.id))
					.where(where)
					.orderBy(groupMemberships.joinedAt)
					.limit(limit)
					.offset(offset),
			]);
			total = Number(countRows[0]?.total ?? 0);
			rows = memberRows;
		}

		const userIds = rows.map((u) => u.id);
		const [membershipRows, allTags, lastLoginRows, rootRoleRows] =
			userIds.length
				? await Promise.all([
						db
							.select()
							.from(userMemberships)
							.where(inArray(userMemberships.userId, userIds)),
						userTagsService.getAll(),
						db
							.select({
								userId: sessions.userId,
								lastLogin: sql<string>`MAX(${sessions.createdAt})`,
							})
							.from(sessions)
							.where(inArray(sessions.userId, userIds))
							.groupBy(sessions.userId),
						db
							.select({ userId: scopeRoles.userId, role: scopeRoles.role })
							.from(scopeRoles)
							.innerJoin(scopes, eq(scopes.id, scopeRoles.scopeId))
							.where(
								and(
									isNull(scopes.parentId),
									inArray(scopeRoles.userId, userIds),
									inArray(scopeRoles.role, ["admin", "moderator"]),
								),
							),
					])
				: [[], [], [], []];
		const platformRoleMap = new Map(
			rootRoleRows.map((r) => [r.userId, r.role]),
		);

		const membershipMap = new Map(membershipRows.map((m) => [m.userId, m]));
		const tagsByUser = new Map<string, typeof allTags>();
		for (const tag of allTags) {
			if (!userIds.includes(tag.userId)) continue;
			if (!tagsByUser.has(tag.userId)) tagsByUser.set(tag.userId, []);
			tagsByUser.get(tag.userId)?.push(tag);
		}
		const lastLoginMap = new Map(
			lastLoginRows.map((r) => [r.userId, r.lastLogin]),
		);

		return {
			total,
			users: rows.map((u) => ({
				...u,
				membership: membershipMap.get(u.id) ?? null,
				tags: tagsByUser.get(u.id) ?? [],
				lastLogin: lastLoginMap.get(u.id) ?? null,
				/** The user's role on the root scope (a platform admin), if any. */
				platformRole: platformRoleMap.get(u.id) ?? null,
			})),
		};
	},
};
