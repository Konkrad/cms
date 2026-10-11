import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$, useLocation } from "@qwik.dev/router";
import type { ScopeListItem } from "~/contracts/scopes";
import { splitScopePath } from "~/core/router/scope-path";
import { getScopePaths } from "~/core/router/scope-request";
import { toScopeListItem } from "~/core/scopes/scope-list";
import { scopesService } from "~/core/scopes/scopes.service";

/** The child scopes of the scope a page is on (the root's children on an unscoped page). */
const fetchChildScopes = server$(
	async (pathname: string): Promise<ScopeListItem[]> => {
		const { scopePath } = splitScopePath(pathname, await getScopePaths());
		const scope = await scopesService.getByPath(scopePath);
		if (!scope) return [];
		const children = await scopesService.getChildrenWithMemberCounts(scope.id);
		return children.map(toScopeListItem);
	},
);

/**
 * Headless composable owning data-fetching for the "Groups List" page-builder block: the groups
 * (child scopes) of the scope the page belongs to.
 */
export function useScopesList() {
	const location = useLocation();
	const scopes = useSignal<ScopeListItem[]>([]);
	const isLoading = useSignal(true);
	const error = useSignal<string | null>(null);

	useTask$(async () => {
		try {
			scopes.value = await fetchChildScopes(location.url.pathname);
		} catch (e) {
			error.value = e instanceof Error ? e.message : "Failed to load groups";
		} finally {
			isLoading.value = false;
		}
	});

	return { scopes, isLoading, error };
}
