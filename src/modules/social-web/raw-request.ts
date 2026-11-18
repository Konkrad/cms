import type { IncomingMessage } from "node:http";
import { requestPath, vouchForOrigin } from "../../core/router/server-origin";
import { INBOX_PATH } from "./paths";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * FEP-b06c: the inbox of a poll-only actor answers 405 to every write. Qwik's origin check would
 * answer a write from another server (or `curl -X POST`) with 403 before the route runs. The
 * inbox handler reads no body and authorizes nothing by cookie, so writes to this one path pass
 * the check (`vouchForOrigin`) and the route answers 405 (404 while the module is inactive).
 * Runs before Qwik (`src/core/registry/raw-request.ts`).
 */
export function allowInboxWrite(
	req: IncomingMessage,
	serverOrigin: string,
): void {
	if (READS.has(req.method ?? "GET")) return;
	if (requestPath(req) !== INBOX_PATH) return;
	vouchForOrigin(req, serverOrigin);
}
