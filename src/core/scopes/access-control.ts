import type { RequestEvent } from "~/core/auth/server-auth";
import { getCurrentUserData } from "~/core/auth/server-auth";
import type { Group, User } from "~/core/db/schema";
import { groupRepresentativesService } from "~/core/scopes/group-representatives.service";
import { groupsService } from "~/core/scopes/groups.service";

export async function canManageGroupContent(
	userId: string,
	groupId: string,
): Promise<boolean> {
	return await groupRepresentativesService.isRepresentative(userId, groupId);
}

export function isPlatformAdmin(user: User): boolean {
	return user.role === "admin";
}

export type GroupAdminContext =
	| { user: User; isGlobal: true; group: null }
	| { user: User; isGlobal: false; group: Group };

/**
 * Authorize a request against the `[group_slug]` admin scope.
 *
 * Must be called at the top of every mutating admin `routeAction$`: in Qwik an
 * action handler runs BEFORE route/layout loaders, so the layout's loader-based
 * auth check does not protect actions. Mirrors the logic in
 * `admin/[group_slug]/layout.tsx`.
 */
export async function requireGroupAdmin(
	event: RequestEvent,
): Promise<GroupAdminContext> {
	const user = await getCurrentUserData(event);
	if (!user) throw event.redirect(302, "/login");

	const groupSlug = (event as { params?: Record<string, string> }).params
		?.group_slug;

	if (groupSlug === "global") {
		if (user.role !== "admin") throw event.redirect(302, "/");
		return { user: user as unknown as User, isGlobal: true, group: null };
	}

	const group = groupSlug ? await groupsService.getBySlug(groupSlug) : null;
	if (!group) throw event.redirect(302, "/groups");

	const canManage = await canManageGroupContent(user.id, group.id);
	if (!canManage) throw event.redirect(302, `/groups/${group.slug}`);

	return { user: user as unknown as User, isGlobal: false, group };
}
