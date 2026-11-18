import { count, inArray } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { articles, notes, pages, users } from "~/core/db/schema";
import { scopesService } from "~/core/scopes/scopes.service";

/** Core counts for the admin dashboard (`/admin/[scope]`); modules add widgets via the `admin.dashboard.widgets` slot. */
export const adminDashboardService = {
	async getGlobalStats() {
		const [[totalUsers], [totalNotes], [totalArticles], [totalPages]] =
			await Promise.all([
				db.select({ count: count() }).from(users),
				db.select({ count: count() }).from(notes),
				db.select({ count: count() }).from(articles),
				db.select({ count: count() }).from(pages),
			]);
		return {
			notes: totalNotes?.count || 0,
			articles: totalArticles?.count || 0,
			users: totalUsers?.count || 0,
			pages: totalPages?.count || 0,
		};
	},

	/** Counts for a scope and every scope below it. */
	async getScopeStats(scopeId: string) {
		const ids = await scopesService.subtreeIds(scopeId);
		const [members, [groupNotes], [groupArticles]] = await Promise.all([
			scopesService.countMembers(scopeId, { includeDescendants: true }),
			db
				.select({ count: count() })
				.from(notes)
				.where(inArray(notes.scopeId, ids)),
			db
				.select({ count: count() })
				.from(articles)
				.where(inArray(articles.scopeId, ids)),
		]);
		return {
			members,
			notes: groupNotes?.count || 0,
			articles: groupArticles?.count || 0,
		};
	},
};
