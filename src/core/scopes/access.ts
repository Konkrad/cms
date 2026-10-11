/**
 * The access layer: every authorization decision goes through scope roles
 * (`scope_roles`, inherited downward) and memberships (`scope_memberships`, counting
 * upward). There is no platform role on `users`: a platform admin is an admin (or
 * moderator) of the root scope.
 *
 * Roles: admin and moderator have the same rights. A representative manages their
 * scope and everything below it, without the root-only system sections. A coordinator
 * only reviews content (no admin access).
 */
import type { RequestEventBase } from "@qwik.dev/router";
import { getCurrentUserData, type RequestEvent } from "~/core/auth/server-auth";
import { isAncestorPath, pathFromAdminSegment } from "~/core/router/scope-path";
import { currentScope } from "~/core/router/scope-request";
import type { Scope } from "~/core/scopes/schema/scopes";
import {
	type ListMembersOptions,
	type Role,
	type ScopeMember,
	scopesService,
	type Visibility,
} from "~/core/scopes/scopes.service";

export type { Role, ScopeMember, Visibility };

/** A minimum role, or an explicit list of roles of which any one is enough. */
export type MinRole = Role | readonly Role[];

/** Anything carrying a user id; `null`/`undefined` is a guest. */
export type AccessUser = { id: string } | null | undefined;

/**
 * The roles that satisfy each minimum role. Admin and moderator are equal and satisfy every
 * requirement; a representative is not a reviewer and a coordinator is not a manager.
 */
const SATISFIED_BY: Record<Role, readonly Role[]> = {
	admin: ["admin", "moderator"],
	moderator: ["admin", "moderator"],
	representative: ["admin", "moderator", "representative"],
	coordinator: ["admin", "moderator", "coordinator"],
};

/** Every role that satisfies `minRole` (for a list: satisfies any entry of it). */
export function rolesSatisfying(minRole: MinRole): Role[] {
	const wanted: readonly Role[] =
		typeof minRole === "string" ? [minRole] : minRole;
	return [...new Set(wanted.flatMap((r) => SATISFIED_BY[r]))];
}

/** Roles that may open a scope's admin: managers, i.e. not coordinators. */
export const ADMIN_ACCESS: MinRole = "representative";

/** The logged-in user (full row, server-only) or null. */
export async function currentUser(event: RequestEvent) {
	return getCurrentUserData(event);
}

/** Whether the user holds `minRole` on the scope, directly or on an ancestor. */
export async function canManageScope(
	user: AccessUser,
	scopeId: string,
	minRole: MinRole,
): Promise<boolean> {
	if (!user) return false;
	return scopesService.hasRole(user.id, scopeId, rolesSatisfying(minRole));
}

/**
 * Whether the user may see an item with this visibility in this scope: `public` for
 * everyone, `members` for members of the scope or of any scope below it and for every
 * role holder on it (inherited), `representatives` for role holders only.
 */
export async function canViewScope(
	user: AccessUser,
	scopeId: string,
	visibility: Visibility,
): Promise<boolean> {
	return scopesService.canView(user?.id ?? null, scopeId, visibility);
}

/** Membership check counting upward: a Berlin member is a member of Germany. */
export async function isMember(
	user: AccessUser,
	scopeId: string,
): Promise<boolean> {
	if (!user) return false;
	return scopesService.isMember(user.id, scopeId);
}

/** Members of a scope as public profiles (`includeDescendants` adds the scopes below). */
export async function listMembers(
	scopeId: string,
	options?: ListMembersOptions,
): Promise<ScopeMember[]> {
	return scopesService.listMembers(scopeId, options);
}

/**
 * Scopes the user may administer with at least `minRole` (default: any managing role),
 * including the scopes below the ones they hold a role on; for pickers and the scope switcher.
 */
export async function listManagedScopes(
	user: AccessUser,
	minRole: MinRole = ADMIN_ACCESS,
): Promise<Scope[]> {
	if (!user) return [];
	return scopesService.listScopesWithRole(user.id, rolesSatisfying(minRole));
}

/** A platform admin: admin (or moderator) of the root scope. */
export async function isPlatformAdmin(user: AccessUser): Promise<boolean> {
	if (!user) return false;
	const root = await scopesService.getRoot();
	return !!root && canManageScope(user, root.id, "admin");
}

/**
 * The scope a request is about: the `[scope]` admin segment when the route has one
 * (`/admin/germany.berlin/...`), else the scope prefix of a public URL (`/germany/berlin/...`).
 */
export async function requestScope(
	event: Pick<RequestEventBase, "sharedMap" | "params">,
): Promise<Scope | undefined> {
	const segment = event.params?.scope;
	if (segment === undefined) return currentScope(event);
	const path = pathFromAdminSegment(segment);
	return path ? scopesService.getByPath(path) : undefined;
}

export interface ScopeAccess {
	user: NonNullable<Awaited<ReturnType<typeof currentUser>>>;
	scope: Scope;
	/** Root first, excluding `scope`. */
	ancestors: Scope[];
}

/**
 * Authorize a request against the scope in its URL. Call it as the FIRST statement of every
 * action, admin loader and API handler (never inside `try`: it signals failure by throwing).
 * Redirects to /login when logged out, 404s for an unknown scope and 403s when the user lacks
 * `minRole` on the scope (roles inherit downward).
 */
export async function requireScopeRole(
	event: RequestEvent,
	minRole: MinRole,
): Promise<ScopeAccess> {
	const user = await currentUser(event);
	if (!user) throw event.redirect(302, "/login");
	const scope = await requestScope(event);
	if (!scope) throw event.error(404, "Not found");
	if (!(await canManageScope(user, scope.id, minRole))) {
		throw event.error(403, "Forbidden");
	}
	const ancestors = await scopesService.getAncestors(scope.id);
	return { user, scope, ancestors };
}

/**
 * Platform admin guard (admin or moderator of the root), whatever scope the URL names: for the
 * root-only system sections (users, pages, tags, notifications, …) and their actions.
 * Same throwing behaviour as `requireScopeRole`.
 */
export async function requireAdmin(event: RequestEvent) {
	const user = await currentUser(event);
	if (!user) throw event.redirect(302, "/login");
	if (!(await isPlatformAdmin(user))) throw event.error(403, "Forbidden");
	return user;
}

/** userId -> public label ("Local Rep Berlin", or the name of a scope they joined). */
export async function scopeLabels(
	userIds: string[],
): Promise<Record<string, string>> {
	return scopesService.getScopeLabels(userIds);
}

/** Read the tree. */
export const getScope = (id: string) => scopesService.getById(id);
export const getRootScope = () => scopesService.getRoot();
export const getAncestors = (scopeId: string) =>
	scopesService.getAncestors(scopeId);
export const getDescendants = (scopeId: string) =>
	scopesService.getDescendants(scopeId);
/** Ids of the scope and every scope below it. */
export const getSubtreeIds = (scopeId: string) =>
	scopesService.subtreeIds(scopeId);

/**
 * Whether an item owned by `itemScopeId` lies in `scope`'s subtree, i.e. may be managed from
 * that scope's admin. Use it in admin loaders and actions after `requireScopeRole`.
 */
export async function isWithinScope(
	scope: Scope,
	itemScopeId: string,
): Promise<boolean> {
	if (scope.parentId === null) return true;
	const item = await scopesService.getById(itemScopeId);
	return !!item && isAncestorPath(scope.path, item.path);
}

/**
 * 404 unless the item exists and lies in `scope`'s subtree. For admin loaders and actions that
 * take an item id (from the URL or the form body), right after the auth call, so a
 * representative can neither read nor change a sibling scope's item by id.
 */
export async function requireWithinScope(
	event: Pick<RequestEvent, "error">,
	scope: Scope,
	item: { scopeId: string } | null | undefined,
): Promise<void> {
	if (!item || !(await isWithinScope(scope, item.scopeId))) {
		throw event.error(404, "Not found");
	}
}

/**
 * Guard for the system sections (users, pages, tags, notifications, …), which exist on the
 * root only: an admin (or moderator) of the root, on the root's admin URL. 404 on any other
 * scope. First statement of every loader and action of those sections.
 */
export async function requireSystemAdmin(
	event: RequestEvent,
): Promise<ScopeAccess> {
	const access = await requireScopeRole(event, "admin");
	if (access.scope.parentId !== null) throw event.error(404, "Not found");
	return access;
}

/**
 * The visibilities the user may give an item owned by the scope. Public content of a scope is
 * listed on every ancestor (content flows up), so it needs a coordinator, admin or moderator
 * of the scope or above (spec 4.9: their content skips review). Representatives may publish to
 * members and representatives only until reviews exist.
 */
export async function allowedVisibilities(
	user: AccessUser,
	scopeId: string,
): Promise<Visibility[]> {
	return (await canManageScope(user, scopeId, "coordinator"))
		? ["public", "members", "representatives"]
		: ["members", "representatives"];
}

/**
 * Whether the user may grant or revoke `role` on a scope: managing roles (admin, moderator)
 * and coordinator need an admin/moderator role on it (inherited); a representative may only
 * grant or revoke "representative".
 */
export async function canGrantRole(
	user: AccessUser,
	scopeId: string,
	role: Role,
): Promise<boolean> {
	return canManageScope(
		user,
		scopeId,
		role === "representative" ? "representative" : "admin",
	);
}
