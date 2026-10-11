import type { IncomingMessage } from "node:http";

/** Unsubscribe endpoint (`src/routes/api/notifications/unsubscribe`). */
export const UNSUBSCRIBE_PATH = "/api/notifications/unsubscribe";

/**
 * RFC 8058 one-click unsubscribe: the mail provider POSTs `List-Unsubscribe=One-Click` as
 * application/x-www-form-urlencoded from its own servers, without our Origin. Qwik's CSRF
 * check rejects exactly that (cross-site form POST). The endpoint is authorized by its signed
 * token, not by cookies, so CSRF does not apply to it: for this one path and method only, the
 * content type is relabelled before Qwik sees the request. Used by the production server
 * (entry.node-server.tsx) and the dev server (vite.config.ts). No app imports: vite.config
 * loads this file.
 */
export function allowOneClickUnsubscribe(req: IncomingMessage): void {
	if (req.method !== "POST") return;
	const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
	if (path !== UNSUBSCRIBE_PATH) return;
	req.headers["content-type"] = "application/x-one-click-unsubscribe";
}
