import type { PaymentLine, PaymentMode } from "~/core/payments/schema";

/**
 * The payment provider adapter (spec 4.7). Core talks to the provider only through this
 * interface; Stripe is the only adapter (`stripe-provider.ts`). Server-only.
 */

/** A change of a payment's status as a provider reports it, normalized. */
export type PaymentChange =
	| "paid"
	| "failed"
	| "expired"
	| "refunded"
	| "renewed"
	| "payment_failed"
	| "canceled";

/** A verified provider event, normalized. `change: null` = not a status change core tracks. */
export interface ProviderEvent {
	/** The provider's event id (stored with the change it caused). */
	eventId: string;
	/** The provider's event type, for logs. */
	type: string;
	change: PaymentChange | null;
	/** Core's payment id when the provider carries it back (metadata / client reference). */
	paymentId?: string | null;
	/** The provider's checkout id (Stripe Checkout Session). */
	providerRef?: string | null;
	/** The payment or subscription behind the checkout (Stripe PaymentIntent / Subscription). */
	providerPaymentRef?: string | null;
	/**
	 * Distinguishes changes that happen more than once (each renewal or failed renewal of a
	 * subscription: the invoice id). Core calls the handler once per (payment, change, occurrence).
	 */
	occurrence?: string | null;
}

export interface CheckoutRequest {
	paymentId: string;
	mode: PaymentMode;
	currency: string;
	lines: PaymentLine[];
	/** Absolute URLs the buyer returns to; neither is proof of payment. */
	successUrl: string;
	cancelUrl: string;
	/** The provider must stop accepting the checkout at this time. */
	expiresAt: Date;
	/** Prefills the buyer's email on the provider's page (looked up server-side). */
	customerEmail?: string | null;
}

/** Thrown by `verifyWebhook` for a missing or invalid signature. */
export class WebhookSignatureError extends Error {
	constructor(message = "Invalid webhook signature") {
		super(message);
		this.name = "WebhookSignatureError";
	}
}

export interface PaymentProvider {
	/** The `[provider]` segment of `/api/payments/webhook/[provider]`. */
	id: string;
	/** Creates the hosted checkout; the buyer is redirected to `url`. */
	createCheckout(
		request: CheckoutRequest,
	): Promise<{ providerRef: string; url: string }>;
	/** Verifies the signature (throws `WebhookSignatureError`), then normalizes the event. */
	verifyWebhook(body: string, headers: Headers): ProviderEvent;
	/** Refunds a paid one-off payment in full. */
	refund(payment: {
		providerRef: string | null;
		providerPaymentRef: string | null;
	}): Promise<{ refundId: string }>;
	/** Cancels a subscription at once. */
	cancelSubscription(payment: {
		providerPaymentRef: string | null;
	}): Promise<void>;
	/**
	 * Closes an unfinished checkout so it can no longer be paid. Returns false when it was
	 * completed meanwhile (its paid event is on the way and must not be lost).
	 */
	expireCheckout(providerRef: string): Promise<boolean>;
}
