import type { IncomingMessage } from "node:http";
import { allowInboxWrite } from "../../modules/social-web/raw-request";
import { allowOneClickUnsubscribe } from "../notifications/one-click";
import { allowPaymentWebhook } from "../payments/webhook-origin";
import { rewriteWellKnown } from "../router/well-known";

/**
 * Adjusts the raw Node request before Qwik sees it, in the production server
 * (entry.node-server.tsx) and the dev server (vite.config.ts): `/.well-known/*` routing and
 * the server-to-server endpoints that must pass Qwik's origin check (payment webhook, one-click
 * unsubscribe, the social-web inbox's 405 answers). `serverOrigin` is the origin Qwik compares
 * the `Origin` header with. No app imports (no `~` aliases, no env): vite.config.ts loads this
 * file.
 */
export function prepareRawRequest(
	req: IncomingMessage,
	serverOrigin: string,
): void {
	rewriteWellKnown(req);
	allowPaymentWebhook(req, serverOrigin);
	allowOneClickUnsubscribe(req, serverOrigin);
	allowInboxWrite(req, serverOrigin);
}
