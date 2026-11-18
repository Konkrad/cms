import type { IncomingMessage } from "node:http";
import { requestPath, vouchForOrigin } from "../router/server-origin";

/** Unsubscribe endpoint (`src/routes/api/notifications/unsubscribe`). */
export const UNSUBSCRIBE_PATH = "/api/notifications/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe: the mail provider POSTs `List-Unsubscribe=One-Click` from its
 * own servers, without our Origin, which Qwik's origin check rejects. The endpoint is authorized
 * by its signed token, not by cookies, so CSRF does not apply: for this one path and method the
 * request passes the check (`vouchForOrigin`). Called through `prepareRawRequest`
 * (src/core/registry/raw-request.ts) by the production and dev servers. No app imports.
 */
export function allowOneClickUnsubscribe(
	req: IncomingMessage,
	serverOrigin: string,
): void {
	if (req.method !== "POST") return;
	if (requestPath(req) !== UNSUBSCRIBE_PATH) return;
	vouchForOrigin(req, serverOrigin);
}
