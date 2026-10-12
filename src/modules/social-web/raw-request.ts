import type { IncomingMessage } from "node:http";
import { INBOX_PATH } from "./paths";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * FEP-b06c: the inbox of a poll-only actor answers 405 to every POST. Qwik's CSRF check would
 * answer a cross-site POST without a content type or with a form type (`curl -X POST`, a browser
 * form) with 403 before the route runs. The inbox handler reads no body and authorizes nothing by
 * cookie, so for writes to this one path the content type is relabelled and the route answers
 * 405 (404 while the module is inactive). Runs before Qwik (`src/core/registry/raw-request.ts`).
 */
export function relabelInboxWrite(req: IncomingMessage): void {
	if (READS.has(req.method ?? "GET")) return;
	const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
	if (path !== INBOX_PATH) return;
	req.headers["content-type"] = "application/x-poll-only-inbox";
}
