import type { RequestHandler } from "@qwik.dev/router";
import Stripe from "stripe";
import { dispatchPayment, handleStripeWebhook } from "~/core/payments/payments";
import { allModules } from "~/core/registry/manifests";
import { env } from "~/env";

/** Stripe webhook: verifies the signature, then hands the payment to the owning module. */
export const onPost: RequestHandler = async ({ request, json }) => {
	const { status, body } = await handleStripeWebhook({
		body: await request.text(),
		signature: request.headers.get("stripe-signature"),
		verify: (payload, signature) =>
			// Static helper: verification needs only the secret, no API client.
			Stripe.webhooks.constructEvent(
				payload,
				signature,
				env.STRIPE_WEBHOOK_SECRET,
			),
		// All registered modules, not only active ones: late payments must not be lost.
		dispatch: (event) => dispatchPayment(allModules, event),
	});
	json(status, body);
};
