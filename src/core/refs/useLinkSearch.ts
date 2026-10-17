import { $, useSignal } from "@qwik.dev/core";
import type { RequestEventCommon } from "@qwik.dev/router";
import { server$ } from "@qwik.dev/router";

/** One link picker result: what to store (`ref:…`), a label and the current URL. */
export interface LinkSearchResult {
	href: string;
	label: string;
	url: string;
}

/**
 * Scopes, listings, pages, notes, articles and module items matching `query`, as references. Managers
 * only (anyone with a managing role on some scope): the picker lives in admin editors.
 */
const searchLinks = server$(async function (
	query: string,
): Promise<LinkSearchResult[]> {
	const { requireAuth } = await import("~/core/auth/server-auth");
	const user = await requireAuth(this as RequestEventCommon);
	const { listManagedScopes } = await import("~/core/scopes/access");
	if ((await listManagedScopes(user)).length === 0) return [];
	const { searchLinkTargets } = await import("~/core/registry/refs");
	return searchLinkTargets(String(query).slice(0, 100));
});

/**
 * Headless composable behind the admin link picker (page-builder link fields, the rich text
 * editor): `search$(query)` fills `results` with internal targets as `ref:` links.
 */
export function useLinkSearch() {
	const results = useSignal<LinkSearchResult[]>([]);
	const isLoading = useSignal(false);
	const search$ = $(async (query: string) => {
		if (query.trim().length < 2) {
			results.value = [];
			return;
		}
		isLoading.value = true;
		try {
			results.value = await searchLinks(query);
		} finally {
			isLoading.value = false;
		}
	});
	return { results, isLoading, search$ };
}
