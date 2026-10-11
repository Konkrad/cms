import type { RequestEvent } from "~/core/auth/server-auth";
import { ADMIN_ACCESS, requireScopeRole } from "~/core/scopes/access";

export type FormsAdminScope = {
	scopeType: "global" | "group";
	/** The URL's scope; null on the root (site-wide forms). */
	scopeId: string | null;
	userId: string;
};

/** Authorize a forms admin request against the URL's scope (any managing role). */
export async function resolveFormsAdminScope(
	event: RequestEvent,
): Promise<FormsAdminScope> {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return scope.parentId === null
		? { scopeType: "global", scopeId: null, userId: user.id }
		: { scopeType: "group", scopeId: scope.id, userId: user.id };
}

export function buildFormsAdminBasePath(scopeSegment: string): string {
	return `/admin/${scopeSegment}/forms`;
}
