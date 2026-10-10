import type { RequestHandler } from "@qwik.dev/router";
import { splitScopePath } from "~/utils/scope-path";
import {
	getScopePaths,
	isScopeablePath,
	SCOPE_PATH_KEY,
} from "~/utils/scope-request";

/**
 * Resolves the scope prefix of a hierarchical URL and hands the remainder to Qwik's
 * own file routing: /germany/berlin/events/bbq → scope /germany/berlin/, route
 * /events/bbq. Plugins run again after a rewrite, so the first match wins.
 */
export const onRequest: RequestHandler = async (event) => {
	if (event.sharedMap.has(SCOPE_PATH_KEY)) return;
	const { pathname } = event.url;
	if (!isScopeablePath(pathname)) {
		event.sharedMap.set(SCOPE_PATH_KEY, "/");
		return;
	}
	const { scopePath, rest } = splitScopePath(pathname, await getScopePaths());
	event.sharedMap.set(SCOPE_PATH_KEY, scopePath);
	if (scopePath !== "/") throw event.rewrite(rest);
};
