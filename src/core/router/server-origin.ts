import type { IncomingMessage } from "node:http";

/**
 * Qwik Router (2.0.0-rc) answers 403 to every POST/PUT/PATCH/DELETE whose `Origin` header is not
 * the server's own origin, whatever the content type. A few endpoints are called server to
 * server, without a browser and without our Origin, and authorize without cookies, so CSRF does
 * not apply to them: the payment webhook (provider signature), the RFC 8058 one-click unsubscribe
 * (signed token) and the poll-only social-web inbox (answers 405 to every write). For exactly
 * those paths and methods the request is given the server's origin before Qwik sees it
 * (`prepareRawRequest`). No app imports: vite.config.ts loads this file.
 */
export function vouchForOrigin(
	req: IncomingMessage,
	serverOrigin: string,
): void {
	req.headers.origin = serverOrigin;
}

/** The request path without query string and trailing slashes. */
export function requestPath(req: IncomingMessage): string {
	return (req.url ?? "").split("?")[0].replace(/\/+$/, "");
}
