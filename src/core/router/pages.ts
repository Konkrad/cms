import type { RequestEventLoader } from "@qwik.dev/router";

export type PageParams = Record<string, string>;

export interface PageContext {
	params: PageParams;
	/** Scope path the URL was prefixed with ("/" at the root). */
	scopePath: string;
}

/**
 * A module page served by the catch-all route. `load` runs inside the catch-all's
 * routeLoader$ and must do its own auth first. The view lives in a separate,
 * client-safe registry keyed by `id`, so server code never reaches the browser.
 */
export interface PageDefinition<T> {
	id: string;
	/** Path within a scope: static segments and `:param`, e.g. "/jobs/:id". */
	path: string;
	load: (event: RequestEventLoader, ctx: PageContext) => Promise<T>;
}

export function definePage<T>(page: PageDefinition<T>): PageDefinition<T> {
	return page;
}

const segments = (path: string) => path.split("/").filter(Boolean);

/** Match a path pattern against a pathname; returns decoded params or null. */
export function matchPath(
	pattern: string,
	pathname: string,
): PageParams | null {
	const want = segments(pattern);
	const got = segments(pathname);
	if (want.length !== got.length) return null;
	const params: PageParams = {};
	for (let i = 0; i < want.length; i++) {
		const value = decodeURIComponent(got[i]);
		if (want[i].startsWith(":")) params[want[i].slice(1)] = value;
		else if (want[i] !== value.toLowerCase()) return null;
	}
	return params;
}

/** First page (in declared order) whose path matches the pathname. */
export function matchPage<P extends { path: string }>(
	pages: readonly P[],
	pathname: string,
): { page: P; params: PageParams } | null {
	for (const page of pages) {
		const params = matchPath(page.path, pathname);
		if (params) return { page, params };
	}
	return null;
}
