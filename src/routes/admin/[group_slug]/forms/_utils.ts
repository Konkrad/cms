import { getCurrentUserData } from "~/core/auth/server-auth";
import { isPlatformAdmin } from "~/core/scopes/access";
import { canManageGroupContent } from "~/core/scopes/access-control";
import { groupsService } from "~/core/scopes/groups.service";

export type FormsAdminScope = {
	scopeType: "global" | "group";
	scopeId: string | null;
	userId: string;
};

export async function resolveFormsAdminScope(
	event: any,
): Promise<FormsAdminScope> {
	const user = await getCurrentUserData(event);
	if (!user) {
		throw event.redirect(302, "/login");
	}

	const groupSlug = event.params.group_slug;
	if (groupSlug === "global") {
		if (!(await isPlatformAdmin(user))) {
			throw event.redirect(302, "/");
		}
		return { scopeType: "global", scopeId: null, userId: user.id };
	}

	const group = await groupsService.getBySlug(groupSlug);
	if (!group) {
		throw event.redirect(302, "/groups");
	}

	const canManage = await canManageGroupContent(user.id, group.id);
	if (!canManage) {
		throw event.redirect(302, `/groups/${group.slug}`);
	}

	return { scopeType: "group", scopeId: group.id, userId: user.id };
}

export function buildFormsAdminBasePath(groupSlug: string): string {
	return `/admin/${groupSlug}/forms`;
}
