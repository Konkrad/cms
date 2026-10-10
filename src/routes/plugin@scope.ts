import type { RequestHandler } from "@qwik.dev/router";
import { splitScopePath } from "~/utils/scope-path";
import {
	getScopePaths,
	isScopeablePath,
	SCOPE_PATH_KEY,
	SCOPE_REST_KEY,
} from "~/utils/scope-request";

/**
 * Splits a hierarchical URL into its scope prefix and the remainder:
 * /germany/berlin/jobs/42 → scope /germany/berlin/, rest /jobs/42. The catch-all
 * route ([...path]) resolves the module page from the remainder.
 */
export const onRequest: RequestHandler = async (event) => {
	const { pathname } = event.url;
	const { scopePath, rest } = isScopeablePath(pathname)
		? splitScopePath(pathname, await getScopePaths())
		: { scopePath: "/", rest: pathname };
	event.sharedMap.set(SCOPE_PATH_KEY, scopePath);
	event.sharedMap.set(SCOPE_REST_KEY, rest);
};
