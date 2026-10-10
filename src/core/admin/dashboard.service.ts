import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { events, pages, posts, users } from "~/core/db/schema";
import { groupMemberships } from "~/core/scopes/schema/group-memberships";

/** Counts for the admin dashboard (`/admin/[group_slug]`). */
export const adminDashboardService = {
	async getGlobalStats() {
		const [[totalUsers], [totalPosts], [totalEvents], [totalPages]] =
			await Promise.all([
				db.select({ count: count() }).from(users),
				db
					.select({ count: count() })
					.from(posts)
					.where(isNull(posts.deletedAt)),
				db
					.select({ count: count() })
					.from(events)
					.where(isNull(events.deletedAt)),
				db.select({ count: count() }).from(pages),
			]);
		return {
			posts: totalPosts?.count || 0,
			events: totalEvents?.count || 0,
			users: totalUsers?.count || 0,
			pages: totalPages?.count || 0,
		};
	},

	async getGroupStats(groupId: string) {
		const [[members], [groupPosts], [groupEvents]] = await Promise.all([
			db
				.select({ count: count() })
				.from(groupMemberships)
				.where(eq(groupMemberships.groupId, groupId)),
			db
				.select({ count: count() })
				.from(posts)
				.where(and(eq(posts.groupId, groupId), isNull(posts.deletedAt))),
			db
				.select({ count: count() })
				.from(events)
				.where(and(eq(events.groupId, groupId), isNull(events.deletedAt))),
		]);
		return {
			members: members?.count || 0,
			posts: groupPosts?.count || 0,
			events: groupEvents?.count || 0,
		};
	},
};
