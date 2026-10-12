import { SocksProxyAgent } from "socks-proxy-agent";
import Stripe from "stripe";
import {
	type CheckoutRequest,
	type PaymentProvider,
	type ProviderEvent,
	WebhookSignatureError,
} from "~/core/payments/provider";

/** The Stripe adapter (Checkout Sessions). Server-only. */

export interface StripeProviderConfig {
	secretKey: string;
	webhookSecret: string;
	/** A local stripe-mock or other API host. */
	apiBaseUrl?: string;
	/** SOCKS5 proxy for hosts without a route to Stripe's IPv4-only API. */
	proxyUrl?: string;
}

export const STRIPE_API_VERSION = "2026-06-24.dahlia";

function stripeClient(config: StripeProviderConfig): Stripe {
	const options: ConstructorParameters<typeof Stripe>[1] = {
		apiVersion: STRIPE_API_VERSION,
	};
	if (config.apiBaseUrl) {
		const url = new URL(config.apiBaseUrl);
		options.host = url.hostname;
		const protocol = url.protocol.replace(/:$/, "");
		if (protocol === "http" || protocol === "https")
			options.protocol = protocol;
		if (url.port) options.port = Number(url.port);
	}
	if (config.proxyUrl) options.httpAgent = new SocksProxyAgent(config.proxyUrl);
	return new Stripe(config.secretKey, options);
}

const idOf = (value: string | { id: string } | null | undefined) =>
	typeof value === "string" ? value : (value?.id ?? null);

/** Maps a verified Stripe event to a payment change (null for events core does not track). */
export function normalizeStripeEvent(event: Stripe.Event): ProviderEvent {
	const base = { eventId: event.id, type: event.type };
	switch (event.type) {
		case "checkout.session.completed":
		case "checkout.session.async_payment_succeeded":
		case "checkout.session.async_payment_failed":
		case "checkout.session.expired": {
			const session = event.data.object;
			const refs = {
				paymentId: session.client_reference_id ?? session.metadata?.paymentId,
				providerRef: session.id,
				providerPaymentRef:
					session.mode === "subscription"
						? idOf(session.subscription)
						: idOf(session.payment_intent),
			};
			if (event.type === "checkout.session.expired")
				return { ...base, ...refs, change: "expired" };
			if (event.type === "checkout.session.async_payment_failed")
				return { ...base, ...refs, change: "failed" };
			// Completed but not yet paid (a delayed method): the async event follows.
			const paid =
				session.mode === "subscription" ||
				session.payment_status === "paid" ||
				session.payment_status === "no_payment_required";
			return { ...base, ...refs, change: paid ? "paid" : null };
		}
		case "charge.refunded": {
			const charge = event.data.object;
			return {
				...base,
				// Only a full refund changes the payment's status.
				change: charge.refunded ? "refunded" : null,
				paymentId: charge.metadata?.paymentId,
				providerPaymentRef: idOf(charge.payment_intent),
			};
		}
		case "invoice.paid":
		case "invoice.payment_failed": {
			const invoice = event.data.object;
			const details = invoice.parent?.subscription_details;
			// The first invoice is part of the checkout (checkout.session.completed); only
			// later billing cycles are renewals.
			if (!details || invoice.billing_reason !== "subscription_cycle")
				return { ...base, change: null };
			return {
				...base,
				change: event.type === "invoice.paid" ? "renewed" : "payment_failed",
				paymentId: details.metadata?.paymentId,
				providerPaymentRef: idOf(details.subscription),
				occurrence: invoice.id ?? null,
			};
		}
		case "customer.subscription.deleted": {
			const subscription = event.data.object;
			return {
				...base,
				change: "canceled",
				paymentId: subscription.metadata?.paymentId,
				providerPaymentRef: subscription.id,
			};
		}
		default:
			return { ...base, change: null };
	}
}

export function createStripeProvider(
	config: StripeProviderConfig,
): PaymentProvider {
	let client: Stripe | undefined;
	const stripe = () => {
		client ??= stripeClient(config);
		return client;
	};

	return {
		id: "stripe",

		async createCheckout(request: CheckoutRequest) {
			const metadata = { paymentId: request.paymentId };
			const session = await stripe().checkout.sessions.create({
				mode: request.mode,
				client_reference_id: request.paymentId,
				metadata,
				...(request.mode === "subscription"
					? { subscription_data: { metadata } }
					: { payment_intent_data: { metadata } }),
				line_items: request.lines.map((line) => ({
					quantity: line.quantity,
					price_data: {
						currency: request.currency,
						unit_amount: line.amount,
						product_data: {
							name: line.label,
							...(line.description ? { description: line.description } : {}),
							...(line.imageUrl ? { images: [line.imageUrl] } : {}),
						},
						...(request.mode === "subscription"
							? { recurring: { interval: line.interval ?? "month" } }
							: {}),
					},
				})),
				success_url: request.successUrl,
				cancel_url: request.cancelUrl,
				expires_at: Math.floor(request.expiresAt.getTime() / 1000),
				...(request.customerEmail
					? { customer_email: request.customerEmail }
					: {}),
			});
			if (!session.url) throw new Error("Stripe returned no checkout URL");
			return { providerRef: session.id, url: session.url };
		},

		verifyWebhook(body, headers) {
			const signature = headers.get("stripe-signature");
			if (!signature) throw new WebhookSignatureError("No signature");
			let event: Stripe.Event;
			try {
				// Static helper: verification needs only the secret, no API call.
				event = Stripe.webhooks.constructEvent(
					body,
					signature,
					config.webhookSecret,
				);
			} catch (error) {
				throw new WebhookSignatureError(
					error instanceof Error ? error.message : undefined,
				);
			}
			return normalizeStripeEvent(event);
		},

		async refund(payment) {
			let paymentIntent = payment.providerPaymentRef;
			if (!paymentIntent && payment.providerRef) {
				const session = await stripe().checkout.sessions.retrieve(
					payment.providerRef,
				);
				paymentIntent = idOf(session.payment_intent);
			}
			if (!paymentIntent) throw new Error("No Stripe payment to refund");
			const refund = await stripe().refunds.create({
				payment_intent: paymentIntent,
			});
			return { refundId: refund.id };
		},

		async cancelSubscription(payment) {
			if (!payment.providerPaymentRef)
				throw new Error("No Stripe subscription to cancel");
			await stripe().subscriptions.cancel(payment.providerPaymentRef);
		},

		async expireCheckout(providerRef) {
			const session = await stripe().checkout.sessions.retrieve(providerRef);
			if (session.status === "complete") return false;
			if (session.status === "open")
				await stripe().checkout.sessions.expire(providerRef);
			return true;
		},
	};
}
