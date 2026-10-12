import type { IncomingMessage } from "node:http";
import { relabelInboxWrite } from "../../modules/social-web/raw-request";
import { allowOneClickUnsubscribe } from "../notifications/one-click";
import { rewriteWellKnown } from "../router/well-known";

/**
 * Adjusts the raw Node request before Qwik sees it, in the production server
 * (entry.node-server.tsx) and the dev server (vite.config.ts): the one-click unsubscribe POST,
 * `/.well-known/*` routing and the social-web inbox's 405 answers. No app imports (no `~`
 * aliases, no env): vite.config.ts loads this file.
 */
export function prepareRawRequest(req: IncomingMessage): void {
	allowOneClickUnsubscribe(req);
	rewriteWellKnown(req);
	relabelInboxWrite(req);
}
