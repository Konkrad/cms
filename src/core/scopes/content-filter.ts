/**
 * Which scoped items a listing shows (spec 4.3, "URLs and content flow"). Server-only.
 *
 * A listing belongs to a scope (the URL's scope prefix; the root when there is none):
 * - Own and down: the listing scope's items and its ancestors' items, each subject to its
 *   visibility (`public` for everyone; `members` for members of the owning scope or of a scope
 *   below it, membership counting upward, and role holders on it; `representatives` for role
 *   holders on the owning scope, inherited from above).
 * - Up: PUBLIC items of every scope below the listing scope.
 * - Never up: members-only and representatives-only items of a scope below the listing scope
 *   are not listed there, whoever looks (they stay in their own subtree's listings).
 *
 * Tables without a visibility column (jobs, deals, election cycles) count as public.
 */

import type { RequestEventBase } from "@qwik.dev/router";
import { and, type Column, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { getServerSession } from "~/core/auth/server-auth";
import { currentScope } from "~/core/router/scope-request";
import { type AccessUser, getRootScope } from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";
import type { Visibility } from "~/core/scopes/visibility";

/** The scope sets a listing is decided on; see `resolveContentScopes`. */
export interface ContentScopes {
	/** The listing scope and its ancestors. */
	ownAndAncestorIds: readonly string[];
	/** Every scope below the listing scope. */
	descendantIds: readonly string[];
	/** Scopes whose members-only items the viewer may see. */
	memberIds: readonly string[];
	/** Scopes whose representatives-only items the viewer may see. */
	roleIds: readonly string[];
}

/** An item as the filter sees it: its owning scope and (optional) visibility. */
export interface ScopedItem {
	scopeId: string;
	visibility?: string | null;
}

export interface ContentFilter {
	/** The listing scope. */
	scope: Scope;
	/**
	 * SQL condition on a table's owning-scope column (and visibility column, when the table has
	 * one). Works in select builders (`.where(and(..., filter.where(t)))`) and in relational
	 * queries via `RAW: (t) => filter.where({ scopeId: t.scopeId, visibility: t.visibility })`.
	 */
	where(columns: { scopeId: Column; visibility?: Column }): SQL;
	/** The same rule for one item in memory. */
	matches(item: ScopedItem): boolean;
	/** Whether an item of `scopeId` comes from above the listing scope (flows down). */
	isInherited(scopeId: string): boolean;
}

/**
 * The first `limit` items of a listing (already in display order), the listing scope's own
 * and its subtree's items before the ones inherited from ancestors, so a short teaser (a scope
 * home page) is not filled by the ancestors' content alone. Display order is kept within each
 * group; the caller re-sorts the result if it needs one order.
 */
export function localFirst<T extends { scopeId: string }>(
	items: readonly T[],
	filter: Pick<ContentFilter, "isInherited">,
	limit: number,
): T[] {
	const local = items.filter((i) => !filter.isInherited(i.scopeId));
	const inherited = items.filter((i) => filter.isInherited(i.scopeId));
	return [...local, ...inherited].slice(0, limit);
}

/** The rule of `ContentFilter.matches`, on precomputed scope sets (pure). */
export function listsItem(scopes: ContentScopes, item: ScopedItem): boolean {
	const visibility = (item.visibility ?? "public") as Visibility;
	if (scopes.ownAndAncestorIds.includes(item.scopeId)) {
		if (visibility === "public") return true;
		if (visibility === "members")
			return scopes.memberIds.includes(item.scopeId);
		return scopes.roleIds.includes(item.scopeId);
	}
	return scopes.descendantIds.includes(item.scopeId) && visibility === "public";
}

const inIds = (column: Column, ids: readonly string[]): SQL =>
	ids.length ? inArray(column, [...ids]) : sql`0`;

/** The rule of `ContentFilter.where`, on precomputed scope sets. */
export function contentScopesSql(
	scopes: ContentScopes,
	columns: { scopeId: Column; visibility?: Column },
): SQL {
	const { scopeId, visibility } = columns;
	if (!visibility) {
		return inIds(scopeId, [
			...scopes.ownAndAncestorIds,
			...scopes.descendantIds,
		]);
	}
	// Own and ancestors' items by visibility; descendants' public items.
	const ownOrAncestor = scopes.ownAndAncestorIds;
	const memberIds = ownOrAncestor.filter((id) => scopes.memberIds.includes(id));
	const roleIds = ownOrAncestor.filter((id) => scopes.roleIds.includes(id));
	return or(
		and(
			eq(visibility, "public"),
			inIds(scopeId, [...ownOrAncestor, ...scopes.descendantIds]),
		),
		and(eq(visibility, "members"), inIds(scopeId, memberIds)),
		and(eq(visibility, "representatives"), inIds(scopeId, roleIds)),
	) as SQL;
}

/** The scope sets for a viewer (null = guest) looking at the listing of `listingScopeId`. */
export async function resolveContentScopes(
	viewerId: string | null,
	listingScopeId: string,
): Promise<ContentScopes> {
	const [levels, memberIds, roleIds] = await Promise.all([
		scopesService.contentFilter(listingScopeId),
		scopesService.memberVisibleScopeIds(viewerId),
		scopesService.roleVisibleScopeIds(viewerId),
	]);
	return { ...levels, memberIds, roleIds };
}

/**
 * The listing filter for `viewer` on the listing of `listingScope` (a scope or its id; the root
 * when omitted). Services take it as an argument (or build it) for every listing of scoped
 * content; single items use `canViewScope`.
 */
export async function scopeContentFilter(
	viewer: AccessUser,
	listingScope?: Scope | string | null,
): Promise<ContentFilter> {
	const scope =
		typeof listingScope === "string"
			? await scopesService.getById(listingScope)
			: (listingScope ?? (await getRootScope()));
	if (!scope) throw new Error("Listing scope not found");
	const scopes = await resolveContentScopes(viewer?.id ?? null, scope.id);
	return {
		scope,
		where: (columns) => contentScopesSql(scopes, columns),
		matches: (item) => listsItem(scopes, item),
		isInherited: (scopeId) =>
			scopeId !== scope.id && scopes.ownAndAncestorIds.includes(scopeId),
	};
}

/**
 * The filter of the current request: the logged-in viewer (guest when logged out) on the
 * listing of the URL's scope prefix (the root without one). For public loaders, page `load`s
 * and the `server$` fetchers of listing blocks (pass `this`).
 */
export async function requestContentFilter(
	event: Pick<RequestEventBase, "sharedMap" | "cookie">,
): Promise<ContentFilter> {
	const [viewer, scope] = await Promise.all([
		getServerSession(event as Parameters<typeof getServerSession>[0]),
		currentScope(event),
	]);
	return scopeContentFilter(viewer, scope);
}

/**
 * Source labels for listed items (spec 4.3: a node lists its ancestors' items "labelled with
 * their source"): scope id → that scope's name, for every id other than the listing scope.
 */
export async function scopeSourceLabels(
	listingScopeId: string,
	itemScopeIds: readonly string[],
): Promise<Record<string, string>> {
	const ids = [...new Set(itemScopeIds)].filter((id) => id !== listingScopeId);
	const scopes = await Promise.all(ids.map((id) => scopesService.getById(id)));
	return Object.fromEntries(
		scopes.filter((s): s is Scope => !!s).map((s) => [s.id, s.name]),
	);
}
