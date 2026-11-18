import type { RequestHandler } from "@qwik.dev/router";
import { handlePaymentWebhook } from "~/core/payments/payments";

/**
 * Payment provider webhook (spec 4.7). Public: the provider calls it without a session, so
 * the signature is the authorization; it is verified before anything else.
 */
export const onPost: RequestHandler = async ({ params, request, json }) => {
	const { status, body } = await handlePaymentWebhook(
		params.provider,
		await request.text(),
		request.headers,
	);
	json(status, body);
};
