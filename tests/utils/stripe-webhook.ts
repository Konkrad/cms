import Stripe from "stripe";

/**
 * A signed Stripe webhook for a core payment (spec 4.7), as Stripe would send it to
 * `/api/payments/webhook/stripe`: the checkout session carries the payment id. Signed with
 * STRIPE_WEBHOOK_SECRET (the e2e server's secret).
 */
export function signedCheckoutEvent(
	paymentId: string,
	type = "checkout.session.completed",
): { data: string; headers: Record<string, string> } {
	const data = JSON.stringify({
		id: `evt_e2e_${crypto.randomUUID().replaceAll("-", "")}`,
		object: "event",
		type,
		data: {
			object: {
				id: `cs_e2e_${paymentId.replaceAll("-", "")}`,
				object: "checkout.session",
				client_reference_id: paymentId,
				metadata: { paymentId },
				mode: "payment",
				payment_status: "paid",
				payment_intent: `pi_e2e_${paymentId.replaceAll("-", "")}`,
			},
		},
	});
	const signature = Stripe.webhooks.generateTestHeaderString({
		payload: data,
		secret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
	});
	return {
		data,
		headers: {
			"Content-Type": "application/json",
			"Stripe-Signature": signature,
		},
	};
}
