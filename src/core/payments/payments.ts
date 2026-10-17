import { t } from "~/core/i18n";
import { paymentsService } from "~/core/payments/payments.service";
import type {
	PaymentChange,
	PaymentProvider,
	ProviderEvent,
} from "~/core/payments/provider";
import { WebhookSignatureError } from "~/core/payments/provider";
import type {
	Payment,
	PaymentLine,
	PaymentMode,
	PaymentStatus,
} from "~/core/payments/schema";
import { createStripeProvider } from "~/core/payments/stripe-provider";
import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import { usersService } from "~/core/users/users.service";
import { env } from "~/env";

/**
 * Payments (spec 4.7). A module creates a payment with amounts it computed on the server;
 * core stores it, creates the provider's checkout and calls the module's named handler for
 * its `kind` (manifest `payments`) once per status change. Results come only from verified
 * webhooks (never from the buyer's redirect back) and the expiry schedule. Server-only.
 */

// ── Handler types (manifest `payments`) ──────────────────────────────────────────────────

/** What a payment handler receives: the payment as it was when the change happened. */
export interface PaymentInfo {
	id: string;
	moduleId: string;
	kind: string;
	/** The module's own record (e.g. the pending order). */
	refId: string;
	userId: string;
	status: PaymentStatus;
	mode: PaymentMode;
	/** Total in minor units (cents). */
	amount: number;
	currency: string;
	subjectRef: string | null;
	/** What happened (`renewed` for each renewal, …). */
	change: PaymentChange;
}

export interface PaymentHandlerContext {
	now: Date;
}

export type PaymentHandler = (
	payment: PaymentInfo,
	ctx: PaymentHandlerContext,
) => Promise<void>;

/**
 * Handlers for one payment kind. All optional: a missing one means "nothing to do". Each is
 * called once per change and retried until it succeeds (also while the module is inactive),
 * but must still tolerate being called again.
 */
export interface PaymentHandlers {
	onPaid?: PaymentHandler;
	onFailed?: PaymentHandler;
	onExpired?: PaymentHandler;
	onRefunded?: PaymentHandler;
	/** Subscriptions: a later billing cycle was paid. */
	onRenewed?: PaymentHandler;
	/** Subscriptions: a renewal could not be charged (status `past_due`). */
	onPaymentFailed?: PaymentHandler;
	/** Subscriptions: ended. */
	onCanceled?: PaymentHandler;
}

export type PaymentHook = keyof PaymentHandlers;

// ── Provider ─────────────────────────────────────────────────────────────────────────────

/** No payment provider is configured (spec 4.7: payments are disabled; offer a free flow). */
export class PaymentsDisabledError extends Error {
	constructor() {
		super(t("core.payments.unavailable"));
		this.name = "PaymentsDisabledError";
	}
}

/** A module passed an invalid payment (a programming error, never user input). */
export class PaymentInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PaymentInputError";
	}
}

let configuredProvider: PaymentProvider | null | undefined;

/** The configured provider: Stripe when its secret key and webhook secret are set. */
export function paymentProvider(): PaymentProvider | null {
	if (configuredProvider === undefined) {
		configuredProvider =
			env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
				? createStripeProvider({
						secretKey: env.STRIPE_SECRET_KEY,
						webhookSecret: env.STRIPE_WEBHOOK_SECRET,
						apiBaseUrl: env.STRIPE_API_BASE_URL,
						proxyUrl: env.STRIPE_PROXY_URL,
					})
				: null;
	}
	return configuredProvider;
}

/** Tests: replace the provider (null = disabled); `undefined` goes back to the env's. */
export function setPaymentProvider(
	provider: PaymentProvider | null | undefined,
): void {
	configuredProvider = provider;
}

// ── Creating payments ────────────────────────────────────────────────────────────────────

export interface CreatePaymentInput {
	/** Which of the module's `payments` handlers is called back. */
	kind: string;
	/** The module's own record. */
	refId: string;
	/** Who pays (their email is prefilled from the account, server-side). */
	userId: string;
	mode?: PaymentMode;
	/** Amounts in minor units, computed by the module from its own DB prices. */
	lines: PaymentLine[];
	/** Site paths the buyer returns to; core appends `payment=<id>`. Not proof of payment. */
	successPath: string;
	cancelPath: string;
	/** The item paid for (a reference), linked from the admin payments list. */
	subjectRef?: string | null;
}

function withPaymentParam(path: string, id: string): string {
	const url = new URL(path, env.APP_URL);
	url.searchParams.set("payment", id);
	return url.toString();
}

function validateLines(lines: PaymentLine[]): number {
	if (lines.length === 0) throw new PaymentInputError("A payment needs lines");
	let total = 0;
	for (const line of lines) {
		if (!Number.isInteger(line.amount) || line.amount < 0)
			throw new PaymentInputError(
				`Line "${line.label}": amount must be a non-negative integer (minor units)`,
			);
		if (!Number.isInteger(line.quantity) || line.quantity < 1)
			throw new PaymentInputError(
				`Line "${line.label}": quantity must be a positive integer`,
			);
		total += line.amount * line.quantity;
	}
	if (total <= 0)
		throw new PaymentInputError("A payment must be more than zero");
	return total;
}

async function declaresKind(moduleId: string, kind: string): Promise<boolean> {
	// Lazy: the registry loads every module manifest.
	const { allModules } = await import("~/core/registry/manifests");
	return Boolean(allModules.find((m) => m.id === moduleId)?.payments?.[kind]);
}

/** What `payments` offers modules (`~/core`). */
export const payments = {
	/** Whether a provider is configured; without one, offer free flows only. */
	enabled(): boolean {
		return paymentProvider() !== null;
	},

	/**
	 * Stores a pending payment and creates the provider's checkout; redirect the buyer to
	 * `url`. Throws `PaymentsDisabledError` without a provider. Core computes nothing: the
	 * total is the sum of the module's lines.
	 */
	async create(
		ctx: { module: string },
		input: CreatePaymentInput,
		now: Date = new Date(),
	): Promise<{ id: string; url: string }> {
		const provider = paymentProvider();
		if (!provider) throw new PaymentsDisabledError();
		const amount = validateLines(input.lines);
		if (!(await declaresKind(ctx.module, input.kind)))
			throw new PaymentInputError(
				`Module "${ctx.module}" declares no payments handlers for "${input.kind}"`,
			);
		const mode = input.mode ?? "payment";
		const expiresAt = new Date(
			now.getTime() + env.PAYMENTS_CHECKOUT_EXPIRY_MINUTES * 60_000,
		);
		const payment = await paymentsService.insert(
			{
				moduleId: ctx.module,
				kind: input.kind,
				refId: input.refId,
				userId: input.userId,
				mode,
				provider: provider.id,
				amount,
				currency: env.PAYMENTS_CURRENCY,
				lines: input.lines,
				subjectRef: input.subjectRef ?? null,
				expiresAt: expiresAt.toISOString(),
			},
			now,
		);
		const emails = await usersService.getEmailsByIds([input.userId]);
		let checkout: { providerRef: string; url: string };
		try {
			checkout = await provider.createCheckout({
				paymentId: payment.id,
				mode,
				currency: payment.currency,
				lines: input.lines,
				successUrl: withPaymentParam(input.successPath, payment.id),
				cancelUrl: withPaymentParam(input.cancelPath, payment.id),
				expiresAt,
				customerEmail: emails.get(input.userId) ?? null,
			});
		} catch (error) {
			// No checkout exists, so nothing can ever pay this row.
			await paymentsService.delete(payment.id);
			throw error;
		}
		await paymentsService.setProviderRef(payment.id, checkout.providerRef);
		return { id: payment.id, url: checkout.url };
	},

	/**
	 * The status of the viewer's own payment (the page the buyer returns to); undefined for
	 * another user's or an unknown payment. Show it as it is: the return is no proof.
	 */
	async statusForOwner(
		id: string,
		userId: string,
	): Promise<{ status: PaymentStatus; refId: string } | undefined> {
		const payment = await paymentsService.getById(id);
		if (!payment || payment.userId !== userId) return undefined;
		return { status: payment.status, refId: payment.refId };
	},
};

// ── Status changes ───────────────────────────────────────────────────────────────────────

interface Transition {
	from: readonly PaymentStatus[];
	to: (mode: PaymentMode) => PaymentStatus;
	hook: PaymentHook;
}

/** Which change is allowed from which status, the resulting status and the hook it calls. */
export const TRANSITIONS: Record<PaymentChange, Transition> = {
	// A late payment of an expired or failed checkout is never lost.
	paid: {
		from: ["pending", "failed", "expired"],
		to: (mode) => (mode === "subscription" ? "active" : "paid"),
		hook: "onPaid",
	},
	failed: { from: ["pending"], to: () => "failed", hook: "onFailed" },
	expired: { from: ["pending"], to: () => "expired", hook: "onExpired" },
	refunded: { from: ["paid"], to: () => "refunded", hook: "onRefunded" },
	renewed: {
		from: ["active", "past_due"],
		to: () => "active",
		hook: "onRenewed",
	},
	payment_failed: {
		from: ["active", "past_due"],
		to: () => "past_due",
		hook: "onPaymentFailed",
	},
	canceled: {
		from: ["pending", "active", "past_due"],
		to: () => "canceled",
		hook: "onCanceled",
	},
};

export type ApplyResult =
	| { applied: true; status: PaymentStatus; hook: PaymentHook }
	| { applied: false; reason: string };

/** The handler-call kind for payments (`handler_calls.kind`). */
export const PAYMENT_HANDLER_KIND = "payments";

/**
 * Applies a change to a payment: sets the status, queues the module's handler (named, in
 * `handler_calls`, retried until it succeeds) and core's receipt, and records the change with
 * the provider event id. Idempotent per (payment, change[, occurrence]): a resent event
 * queues nothing new. Every step is idempotent, so a crash in between is repaired by the
 * provider's resend.
 */
export async function applyPaymentChange(
	payment: Payment,
	change: PaymentChange,
	source: {
		providerEventId: string | null;
		occurrence?: string | null;
		providerPaymentRef?: string | null;
	},
	now: Date = new Date(),
): Promise<ApplyResult> {
	const key = source.occurrence ? `${change}:${source.occurrence}` : change;
	if (await paymentsService.hasEvent(payment.id, key))
		return { applied: false, reason: "already applied" };

	const transition = TRANSITIONS[change];
	const target = transition.to(payment.mode);
	// `target` itself: a previous attempt set the status but stopped before recording it.
	if (!transition.from.includes(payment.status) && payment.status !== target)
		return {
			applied: false,
			reason: `${change} not allowed from ${payment.status}`,
		};

	const updated = await paymentsService.transition(
		payment.id,
		payment.status,
		{
			status: target,
			providerPaymentRef: source.providerPaymentRef,
			paidAt: change === "paid" ? now.toISOString() : undefined,
		},
		now,
	);
	if (!updated) return { applied: false, reason: "changed concurrently" };

	const info: PaymentInfo = {
		id: updated.id,
		moduleId: updated.moduleId,
		kind: updated.kind,
		refId: updated.refId,
		userId: updated.userId,
		status: updated.status,
		mode: updated.mode,
		amount: updated.amount,
		currency: updated.currency,
		subjectRef: updated.subjectRef,
		change,
	};
	await handlerCallsService.enqueue(
		{
			dedupeKey: `payment:${payment.id}:${key}`,
			owner: payment.moduleId,
			kind: PAYMENT_HANDLER_KIND,
			type: payment.kind,
			hook: transition.hook,
			payload: { ...info, ref: `payment:${payment.id}` },
		},
		now,
	);
	if (change === "paid" || change === "renewed")
		await handlerCallsService.enqueue(
			{
				dedupeKey: `payment:${payment.id}:${key}:receipt`,
				owner: "core",
				kind: PAYMENT_HANDLER_KIND,
				type: "receipt",
				hook: transition.hook,
				payload: { ...info, ref: `payment:${payment.id}` },
			},
			now,
		);
	await paymentsService.recordEvent(
		payment.id,
		key,
		source.providerEventId,
		now,
	);
	return { applied: true, status: target, hook: transition.hook };
}

// ── Webhook ──────────────────────────────────────────────────────────────────────────────

export type WebhookResponse = { status: number; body: Record<string, unknown> };

/**
 * `/api/payments/webhook/[provider]`: verifies the signature BEFORE anything else (no DB
 * access for an unverified request), then applies the change. Unknown payments and events
 * core does not track answer 200 so the provider stops resending; failures while applying
 * propagate (500, the provider resends).
 */
export async function handlePaymentWebhook(
	providerId: string,
	body: string,
	headers: Headers,
	now: Date = new Date(),
): Promise<WebhookResponse> {
	const provider = paymentProvider();
	if (!provider || provider.id !== providerId)
		return { status: 404, body: { error: "Unknown payment provider" } };

	let event: ProviderEvent;
	try {
		event = provider.verifyWebhook(body, headers);
	} catch (error) {
		if (!(error instanceof WebhookSignatureError)) throw error;
		console.warn(`Payment webhook rejected: ${error.message}`);
		return { status: 400, body: { error: "Invalid signature" } };
	}
	if (!event.change)
		return { status: 200, body: { received: true, ignored: event.type } };

	const payment = await paymentsService.findForProviderEvent(
		provider.id,
		event,
	);
	if (!payment) {
		console.warn(
			`Payment webhook ${event.eventId} (${event.type}): no matching payment`,
		);
		return {
			status: 200,
			body: { received: true, ignored: "unknown payment" },
		};
	}
	const result = await applyPaymentChange(
		payment,
		event.change,
		{
			providerEventId: event.eventId,
			occurrence: event.occurrence,
			providerPaymentRef: event.providerPaymentRef,
		},
		now,
	);
	if (!result.applied && result.reason !== "already applied")
		console.warn(
			`Payment webhook ${event.eventId} (${event.type}) for ${payment.id}: ${result.reason}`,
		);
	return { status: 200, body: { received: true } };
}

// ── Expiry (core schedule) ───────────────────────────────────────────────────────────────

/**
 * Marks checkouts that were never completed as expired once past `expiresAt` and calls the
 * module's `onExpired`. The provider's checkout is closed first; one that was completed
 * meanwhile is left alone (its paid event is on the way).
 */
export async function expireStalePayments(
	now: Date = new Date(),
): Promise<{ expired: string[] }> {
	const provider = paymentProvider();
	const expired: string[] = [];
	for (const payment of await paymentsService.listStalePending(now)) {
		if (
			provider &&
			payment.provider === provider.id &&
			payment.providerRef &&
			!(await provider.expireCheckout(payment.providerRef))
		)
			continue;
		const result = await applyPaymentChange(
			payment,
			"expired",
			{ providerEventId: null },
			now,
		);
		if (result.applied) expired.push(payment.id);
	}
	return { expired };
}

// ── Admin ────────────────────────────────────────────────────────────────────────────────

/** A refund or cancellation the admin asked for is not possible for this payment. */
export class PaymentActionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PaymentActionError";
	}
}

/** Refunds a paid one-off payment in full through the provider, then calls `onRefunded`. */
export async function refundPayment(
	id: string,
	now: Date = new Date(),
): Promise<void> {
	const payment = await paymentsService.getById(id);
	if (!payment) throw new PaymentActionError(t("core.payments.notFound"));
	if (payment.mode !== "payment" || payment.status !== "paid")
		throw new PaymentActionError(t("core.payments.onlyPaidRefundable"));
	const provider = paymentProvider();
	if (!provider || provider.id !== payment.provider)
		throw new PaymentActionError(t("core.payments.providerNotConfigured"));
	const { refundId } = await provider.refund(payment);
	// The provider's refund event follows and is then a no-op.
	await applyPaymentChange(
		payment,
		"refunded",
		{ providerEventId: refundId },
		now,
	);
}

/** Cancels a subscription through the provider, then calls `onCanceled`. */
export async function cancelSubscription(
	id: string,
	now: Date = new Date(),
): Promise<void> {
	const payment = await paymentsService.getById(id);
	if (!payment) throw new PaymentActionError(t("core.payments.notFound"));
	if (
		payment.mode !== "subscription" ||
		!["active", "past_due"].includes(payment.status)
	)
		throw new PaymentActionError(t("core.payments.onlyRunningCancelable"));
	const provider = paymentProvider();
	if (!provider || provider.id !== payment.provider)
		throw new PaymentActionError(t("core.payments.providerNotConfigured"));
	await provider.cancelSubscription(payment);
	await applyPaymentChange(payment, "canceled", { providerEventId: null }, now);
}
