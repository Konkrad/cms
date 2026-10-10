import type Stripe from "stripe";
import type { ModuleDefinition } from "~/core/router/modules";

/**
 * Core payment dispatch. Payments are core: the Stripe webhook verifies the signature, then
 * calls back the module that started the payment, named by `metadata.moduleId` and
 * `metadata.kind` on the PaymentIntent (set by the module when it creates the intent).
 */

/** What a module's payment handler receives. */
export interface PaymentContext {
	/** The PaymentIntent the event is about (its metadata is what the module set at creation). */
	paymentIntent: Stripe.PaymentIntent;
	/** The verified Stripe event. */
	event: Stripe.Event;
	/**
	 * Stable across Stripe resends of the same payment (the PaymentIntent id). Stripe delivers
	 * at least once, so a handler must make its side effects idempotent on this key.
	 */
	idempotencyKey: string;
}

export interface PaymentHandlers {
	onPaid?(ctx: PaymentContext): Promise<void>;
	onFailed?(ctx: PaymentContext): Promise<void>;
	onExpired?(ctx: PaymentContext): Promise<void>;
}

const HOOK_BY_EVENT_TYPE = {
	"payment_intent.succeeded": "onPaid",
	"payment_intent.payment_failed": "onFailed",
	"payment_intent.canceled": "onExpired",
} as const satisfies Partial<
	Record<Stripe.Event["type"], keyof PaymentHandlers>
>;

export type DispatchResult =
	| { handled: true; moduleId: string; kind: string; hook: string }
	| { handled: false; reason: string };

/**
 * Routes a verified Stripe event to `module.payments[kind][hook]`. Pass ALL registered modules,
 * not only active ones, so a payment that completes after its module was deactivated is still
 * fulfilled. Events without a handler (other types, missing/unknown metadata, no such hook)
 * are reported as not handled; the webhook answers 200 for those so Stripe stops retrying.
 * Handler errors propagate (the webhook answers 500 and Stripe retries).
 */
export async function dispatchPayment(
	modules: readonly ModuleDefinition[],
	event: Stripe.Event,
): Promise<DispatchResult> {
	const hook =
		HOOK_BY_EVENT_TYPE[event.type as keyof typeof HOOK_BY_EVENT_TYPE];
	if (!hook) return { handled: false, reason: `unhandled type ${event.type}` };

	const paymentIntent = event.data.object as Stripe.PaymentIntent;
	const { moduleId, kind } = paymentIntent.metadata ?? {};
	if (!moduleId || !kind)
		return { handled: false, reason: "no moduleId/kind metadata" };

	const handler = modules.find((m) => m.id === moduleId)?.payments?.[kind]?.[
		hook
	];
	if (!handler)
		return { handled: false, reason: `no ${hook} for ${moduleId}/${kind}` };

	await handler({ paymentIntent, event, idempotencyKey: paymentIntent.id });
	return { handled: true, moduleId, kind, hook };
}

export type WebhookResponse = { status: number; body: Record<string, unknown> };

/**
 * The webhook flow: verify the signature, and only then dispatch. `verify` must throw on a bad
 * signature (Stripe's `webhooks.constructEvent` does).
 */
export async function handleStripeWebhook(params: {
	body: string;
	signature: string | null;
	verify: (body: string, signature: string) => Stripe.Event;
	dispatch: (event: Stripe.Event) => Promise<DispatchResult>;
}): Promise<WebhookResponse> {
	if (!params.signature)
		return { status: 400, body: { error: "No signature" } };

	let event: Stripe.Event;
	try {
		event = params.verify(params.body, params.signature);
	} catch (err) {
		console.error("Webhook signature verification failed:", err);
		return { status: 400, body: { error: "Invalid signature" } };
	}

	try {
		const result = await params.dispatch(event);
		if (!result.handled && event.type in HOOK_BY_EVENT_TYPE)
			console.warn(
				`Stripe webhook ${event.id} (${event.type}) not dispatched: ${result.reason}`,
			);
		return { status: 200, body: { received: true } };
	} catch (err) {
		console.error(`Failed to process Stripe event ${event.id}:`, err);
		return { status: 500, body: { error: "Processing failed" } };
	}
}
