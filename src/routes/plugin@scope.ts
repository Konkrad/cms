import type { RequestHandler } from "@qwik.dev/router";
import { redirectsService } from "~/core/router/redirects.service";
import { splitScopePath } from "~/core/router/scope-path";
import {
	getScopePaths,
	isScopeablePath,
	SCOPE_PATH_KEY,
	SCOPE_REST_KEY,
} from "~/core/router/scope-request";

/**
 * Runs before every route. First answers 301 for an old URL that moved (a moved or renamed
 * scope, its admin URLs, a renamed page; see the redirects table). Then splits a
 * hierarchical URL into its scope prefix and the remainder:
 * /germany/berlin/jobs/42 → scope /germany/berlin/, rest /jobs/42. The catch-all
 * route ([...path]) resolves the module page from the remainder.
 */
export const onRequest: RequestHandler = async (event) => {
	const { pathname, search } = event.url;
	const scopeable = isScopeablePath(pathname);
	if (scopeable && (event.method === "GET" || event.method === "HEAD")) {
		const target = await redirectsService.resolve(pathname);
		if (target) throw event.redirect(301, `${target}${search}`);
	}
	const { scopePath, rest } = scopeable
		? splitScopePath(pathname, await getScopePaths())
		: { scopePath: "/", rest: pathname };
	event.sharedMap.set(SCOPE_PATH_KEY, scopePath);
	event.sharedMap.set(SCOPE_REST_KEY, rest);
};
