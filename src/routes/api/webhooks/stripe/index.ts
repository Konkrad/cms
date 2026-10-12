import type { RequestHandler } from "@qwik.dev/router";
import { handlePaymentWebhook } from "~/core/payments/payments";

/**
 * The old Stripe webhook URL, kept for Stripe endpoints still configured with it (Stripe does
 * not follow redirects for webhooks). Same handler as `/api/payments/webhook/stripe`.
 */
export const onPost: RequestHandler = async ({ request, json }) => {
	const { status, body } = await handlePaymentWebhook(
		"stripe",
		await request.text(),
		request.headers,
	);
	json(status, body);
};
