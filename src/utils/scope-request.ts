import type { RequestEventBase } from "@qwik.dev/router";
import { sqlite } from "~/core/db/connection";
import type { Scope } from "~/db/schemas/scopes";
import { scopesService } from "~/services/scopes.service";

/** sharedMap key holding the scope path matched by plugin@scope for this request. */
export const SCOPE_PATH_KEY = "@scopePath";
/** sharedMap key holding the pathname after the scope prefix, e.g. "/jobs/42". */
export const SCOPE_REST_KEY = "@scopeRest";

// Paths that never carry a scope prefix: API endpoints and static/build assets.
const UNSCOPED_PREFIXES = ["/api/", "/build/", "/assets/", "/@"];

/** True when a pathname may start with a scope prefix and should be matched. */
export function isScopeablePath(pathname: string): boolean {
	return !UNSCOPED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

let cachedPaths: Set<string> | null = null;
let cachedDataVersion = -1;

/** Drop the cached scope paths; call after any scope write. */
export function invalidateScopePaths(): void {
	cachedPaths = null;
}

/**
 * All scope paths, cached in memory. In-process writes invalidate explicitly;
 * SQLite's data_version changes when another connection (seed script, test
 * fixture) commits, which covers writes from outside this process.
 */
export async function getScopePaths(): Promise<ReadonlySet<string>> {
	const dataVersion = sqlite.pragma("data_version", { simple: true }) as number;
	if (!cachedPaths || dataVersion !== cachedDataVersion) {
		cachedPaths = await scopesService.listPaths();
		cachedDataVersion = dataVersion;
	}
	return cachedPaths;
}

/** Scope path of the current request ("/" when no scope prefix matched). */
export function currentScopePath(event: Pick<RequestEventBase, "sharedMap">) {
	return (event.sharedMap.get(SCOPE_PATH_KEY) as string | undefined) ?? "/";
}

/** Pathname after the scope prefix (the whole pathname when no prefix matched). */
export function currentScopeRest(
	event: Pick<RequestEventBase, "sharedMap" | "url">,
): string {
	return (
		(event.sharedMap.get(SCOPE_REST_KEY) as string | undefined) ??
		event.url.pathname
	);
}

/** Scope of the current request; the root scope when no prefix matched. */
export async function currentScope(
	event: Pick<RequestEventBase, "sharedMap">,
): Promise<Scope | undefined> {
	return scopesService.getByPath(currentScopePath(event));
}
