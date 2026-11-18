import type { IncomingMessage } from "node:http";
import { requestPath, vouchForOrigin } from "../router/server-origin";

/** Payment provider webhooks (`src/routes/api/payments/webhook/[provider]`). */
export const PAYMENT_WEBHOOK_PREFIX = "/api/payments/webhook/";

/**
 * The provider (Stripe) POSTs its webhooks from its own servers without our Origin, which Qwik's
 * origin check rejects. The route verifies the provider's signature before anything else and
 * uses no cookies, so CSRF does not apply: for these POSTs the request passes the check
 * (`vouchForOrigin`). Called through `prepareRawRequest`. No app imports.
 */
export function allowPaymentWebhook(
	req: IncomingMessage,
	serverOrigin: string,
): void {
	if (req.method !== "POST") return;
	const path = requestPath(req);
	if (!path.startsWith(PAYMENT_WEBHOOK_PREFIX)) return;
	// One provider segment only (`/api/payments/webhook/stripe`).
	if (path.slice(PAYMENT_WEBHOOK_PREFIX.length).includes("/")) return;
	vouchForOrigin(req, serverOrigin);
}
