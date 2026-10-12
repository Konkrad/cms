import type { IncomingMessage } from "node:http";

/** Where the route files of `/.well-known/*` live (`src/routes/api/well-known`). */
export const WELL_KNOWN_ROUTES = "/api/well-known";

/**
 * Qwik's router never answers `/.well-known/*` (its request handler returns early for those
 * paths), so the raw request is rewritten to `/api/well-known/*` before Qwik sees it:
 * `/.well-known/webfinger?resource=…` is served by `src/routes/api/well-known/webfinger`.
 * No app imports: vite.config.ts loads this file.
 */
export function rewriteWellKnown(req: IncomingMessage): void {
	const prefix = "/.well-known/";
	const url = req.url ?? "";
	if (!url.startsWith(prefix)) return;
	const rewritten = `${WELL_KNOWN_ROUTES}/${url.slice(prefix.length)}`;
	req.url = rewritten;
	// Connect (the dev server) keeps the first URL here, and Qwik prefers it.
	const connect = req as IncomingMessage & { originalUrl?: string };
	if (connect.originalUrl !== undefined) connect.originalUrl = rewritten;
}
