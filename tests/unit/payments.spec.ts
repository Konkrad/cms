/**
 * Payments (spec 4.7): creating payments, the webhook (signature first, one handler call per
 * status change), retried named handlers (also of inactive modules), expiry of abandoned
 * checkouts, disabled mode and the Stripe event mapping. Plan: scratchpad payments-test-plan.
 */
import { like } from "drizzle-orm";
import Stripe from "stripe";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { db } from "~/core/db/connection";
import { resolvePaymentHandler } from "~/core/payments/handlers";
import {
	applyPaymentChange,
	expireStalePayments,
	handlePaymentWebhook,
	type PaymentHandlers,
	PaymentInputError,
	PaymentsDisabledError,
	payments,
	setPaymentProvider,
} from "~/core/payments/payments";
import { paymentsService } from "~/core/payments/payments.service";
import type {
	CheckoutRequest,
	PaymentProvider,
} from "~/core/payments/provider";
import {
	type Payment,
	paymentEvents,
	payments as paymentsTable,
} from "~/core/payments/schema";
import {
	createStripeProvider,
	normalizeStripeEvent,
} from "~/core/payments/stripe-provider";
import { resolveHandlerCall } from "~/core/registry/handlers";
import { processHandlerCallsOnce } from "~/core/scheduler/handler-calls";
import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import { handlerCalls } from "~/core/scheduler/schema";
import { createTestUser } from "./helpers";

const WEBHOOK_SECRET = "whsec_unit_payments";
const stripeProvider = () =>
	createStripeProvider({
		secretKey: process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy",
		webhookSecret: WEBHOOK_SECRET,
		apiBaseUrl: process.env.STRIPE_API_BASE_URL,
	});

function fakeProvider(overrides: Partial<PaymentProvider> = {}) {
	return {
		id: "stripe",
		createCheckout: vi.fn(async () => ({
			providerRef: `cs_${crypto.randomUUID()}`,
			url: "https://pay.example/checkout",
		})),
		verifyWebhook: vi.fn(() => {
			throw new Error("not used");
		}),
		refund: vi.fn(async () => ({ refundId: "re_1" })),
		cancelSubscription: vi.fn(async () => {}),
		expireCheckout: vi.fn(async () => true),
		...overrides,
	} satisfies PaymentProvider;
}

const users: Array<() => void> = [];
function user() {
	const u = createTestUser();
	users.push(u.cleanup);
	return u.userId;
}

async function insertPayment(
	overrides: Partial<Parameters<typeof paymentsService.insert>[0]> = {},
	now = new Date(),
) {
	return paymentsService.insert(
		{
			moduleId: "shop",
			kind: "order",
			refId: crypto.randomUUID(),
			userId: user(),
			mode: "payment",
			provider: "stripe",
			providerRef: `cs_${crypto.randomUUID()}`,
			amount: 1250,
			currency: "eur",
			lines: [{ label: "Thing", amount: 1250, quantity: 1 }],
			expiresAt: new Date(now.getTime() + 3600_000).toISOString(),
			...overrides,
		},
		now,
	);
}

function signed(event: Record<string, unknown>) {
	const body = JSON.stringify(event);
	const headers = new Headers({
		"stripe-signature": Stripe.webhooks.generateTestHeaderString({
			payload: body,
			secret: WEBHOOK_SECRET,
		}),
	});
	return { body, headers };
}

function sessionEvent(
	type: string,
	paymentId: string,
	session: Record<string, unknown> = {},
	id = `evt_${crypto.randomUUID()}`,
) {
	return {
		id,
		object: "event",
		type,
		data: {
			object: {
				id: `cs_${paymentId}`,
				object: "checkout.session",
				client_reference_id: paymentId,
				metadata: { paymentId },
				mode: "payment",
				payment_status: "paid",
				payment_intent: `pi_${paymentId}`,
				subscription: null,
				...session,
			},
		},
	};
}

const callsOf = (paymentId: string) =>
	db
		.select()
		.from(handlerCalls)
		.where(like(handlerCalls.dedupeKey, `payment:${paymentId}:%`));

async function clearQueue() {
	await db
		.delete(handlerCalls)
		.where(like(handlerCalls.dedupeKey, "payment:%"));
}

beforeEach(clearQueue);
afterEach(() => setPaymentProvider(undefined));
afterAll(async () => {
	await clearQueue();
	await db.delete(paymentEvents);
	await db.delete(paymentsTable);
	for (const fn of users.splice(0)) fn();
});

describe("payments.create", () => {
	it("stores a pending payment with the module's amounts and returns the checkout url", async () => {
		const createCheckout = vi.fn(async (_request: CheckoutRequest) => ({
			providerRef: `cs_${crypto.randomUUID()}`,
			url: "https://pay.example/checkout",
		}));
		setPaymentProvider(fakeProvider({ createCheckout }));
		const userId = user();
		const now = new Date("2026-10-12T10:00:00Z");
		const { id, url } = await payments.create(
			{ module: "events" },
			{
				kind: "tickets",
				refId: "order-1",
				userId,
				lines: [
					{ label: "VIP", amount: 2500, quantity: 2 },
					{ label: "Day", amount: 1000, quantity: 1 },
				],
				successPath: "/events/x/checkout",
				cancelPath: "/events/x/checkout?canceled=1",
				subjectRef: "events:event:e1",
			},
			now,
		);
		expect(url).toBe("https://pay.example/checkout");
		const row = await paymentsService.getById(id);
		expect(row).toMatchObject({
			moduleId: "events",
			kind: "tickets",
			refId: "order-1",
			userId,
			status: "pending",
			mode: "payment",
			provider: "stripe",
			amount: 6000,
			currency: "eur",
			subjectRef: "events:event:e1",
		});
		expect(row?.providerRef).toMatch(/^cs_/);
		expect(row?.expiresAt).toBe("2026-10-12T11:00:00.000Z");
		const request = createCheckout.mock.calls[0][0];
		expect(request.successUrl).toMatch(/\/events\/x\/checkout\?payment=/);
		expect(request.cancelUrl).toContain(`canceled=1&payment=${id}`);
		expect(request.expiresAt.toISOString()).toBe(row?.expiresAt);
	});

	it("rejects invalid lines and kinds the module does not declare", async () => {
		setPaymentProvider(fakeProvider());
		const base = {
			kind: "tickets",
			refId: "r",
			userId: user(),
			successPath: "/",
			cancelPath: "/",
		};
		for (const lines of [
			[],
			[{ label: "x", amount: 12.5, quantity: 1 }],
			[{ label: "x", amount: -1, quantity: 1 }],
			[{ label: "x", amount: 100, quantity: 0 }],
			[{ label: "x", amount: 0, quantity: 1 }],
		])
			await expect(
				payments.create({ module: "events" }, { ...base, lines }),
			).rejects.toBeInstanceOf(PaymentInputError);
		await expect(
			payments.create(
				{ module: "events" },
				{
					...base,
					kind: "nope",
					lines: [{ label: "x", amount: 1, quantity: 1 }],
				},
			),
		).rejects.toBeInstanceOf(PaymentInputError);
	});

	it("removes the row when the provider cannot create the checkout", async () => {
		setPaymentProvider(
			fakeProvider({
				createCheckout: vi.fn(async () => {
					throw new Error("provider down");
				}),
			}),
		);
		const userId = user();
		await expect(
			payments.create(
				{ module: "events" },
				{
					kind: "tickets",
					refId: "r",
					userId,
					lines: [{ label: "x", amount: 100, quantity: 1 }],
					successPath: "/",
					cancelPath: "/",
				},
			),
		).rejects.toThrow("provider down");
		const rows = (await db.select().from(paymentsTable)).filter(
			(p) => p.userId === userId,
		);
		expect(rows).toEqual([]);
	});

	it("creates a real checkout through the Stripe adapter (stripe-mock)", async () => {
		const { providerRef, url } = await stripeProvider().createCheckout({
			paymentId: crypto.randomUUID(),
			mode: "payment",
			currency: "eur",
			lines: [{ label: "Ticket", amount: 1500, quantity: 2 }],
			successUrl: "http://localhost/ok",
			cancelUrl: "http://localhost/cancel",
			expiresAt: new Date(Date.now() + 3600_000),
			customerEmail: "buyer@example.com",
		});
		expect(providerRef).toMatch(/^cs_/);
		expect(url).toMatch(/^https:\/\//);
	});
});

describe("disabled mode (no provider configured)", () => {
	it("is not enabled, create throws, the webhook answers 404", async () => {
		setPaymentProvider(null);
		expect(payments.enabled()).toBe(false);
		await expect(
			payments.create(
				{ module: "events" },
				{
					kind: "tickets",
					refId: "r",
					userId: user(),
					lines: [{ label: "x", amount: 100, quantity: 1 }],
					successPath: "/",
					cancelPath: "/",
				},
			),
		).rejects.toBeInstanceOf(PaymentsDisabledError);
		const { body, headers } = signed(
			sessionEvent("checkout.session.completed", "x"),
		);
		expect((await handlePaymentWebhook("stripe", body, headers)).status).toBe(
			404,
		);
	});

	it("is enabled when Stripe is configured (the test env)", () => {
		expect(payments.enabled()).toBe(true);
	});
});

describe("webhook", () => {
	it("rejects an invalid signature before any DB write", async () => {
		setPaymentProvider(stripeProvider());
		const payment = await insertPayment();
		const { body } = signed(
			sessionEvent("checkout.session.completed", payment.id),
		);
		for (const headers of [
			new Headers(),
			new Headers({ "stripe-signature": "t=1,v1=bad" }),
		]) {
			const response = await handlePaymentWebhook("stripe", body, headers);
			expect(response.status).toBe(400);
		}
		// A tampered body with a signature of the original body.
		const { headers } = signed(
			sessionEvent("checkout.session.completed", payment.id),
		);
		expect(
			(
				await handlePaymentWebhook(
					"stripe",
					body.replace("paid", "paix"),
					headers,
				)
			).status,
		).toBe(400);
		expect((await paymentsService.getById(payment.id))?.status).toBe("pending");
		expect(await paymentsService.eventsOf(payment.id)).toEqual([]);
		expect(await callsOf(payment.id)).toEqual([]);
	});

	it("answers 404 for another provider's URL", async () => {
		setPaymentProvider(stripeProvider());
		const { body, headers } = signed(sessionEvent("x", "y"));
		expect((await handlePaymentWebhook("paypal", body, headers)).status).toBe(
			404,
		);
	});

	it("calls the handler once per status change, even when the event is resent", async () => {
		setPaymentProvider(stripeProvider());
		const payment = await insertPayment();
		const paid = signed(
			sessionEvent("checkout.session.completed", payment.id, {}, "evt_paid_1"),
		);
		for (let i = 0; i < 3; i++)
			expect(
				(await handlePaymentWebhook("stripe", paid.body, paid.headers)).status,
			).toBe(200);
		// The same change in a second event (Stripe also sends async_payment_succeeded).
		const again = signed(
			sessionEvent("checkout.session.async_payment_succeeded", payment.id),
		);
		await handlePaymentWebhook("stripe", again.body, again.headers);

		const row = await paymentsService.getById(payment.id);
		expect(row?.status).toBe("paid");
		expect(row?.paidAt).toBeTruthy();
		expect(row?.providerPaymentRef).toBe(`pi_${payment.id}`);
		const events = await paymentsService.eventsOf(payment.id);
		expect(events.map((e) => [e.change, e.providerEventId])).toEqual([
			["paid", "evt_paid_1"],
		]);
		let calls = await callsOf(payment.id);
		expect(calls.map((c) => [c.owner, c.kind, c.type, c.hook]).sort()).toEqual([
			["core", "payments", "receipt", "onPaid"],
			["shop", "payments", "order", "onPaid"],
		]);
		expect(calls.find((c) => c.owner === "shop")?.payload).toMatchObject({
			id: payment.id,
			refId: payment.refId,
			status: "paid",
			change: "paid",
			amount: 1250,
		});

		// A distinct change (a full refund) is a second call.
		const refund = {
			id: "evt_refund_1",
			object: "event",
			type: "charge.refunded",
			data: {
				object: {
					id: "ch_1",
					object: "charge",
					refunded: true,
					metadata: {},
					payment_intent: `pi_${payment.id}`,
				},
			},
		};
		const refunded = signed(refund);
		await handlePaymentWebhook("stripe", refunded.body, refunded.headers);
		await handlePaymentWebhook("stripe", refunded.body, refunded.headers);
		expect((await paymentsService.getById(payment.id))?.status).toBe(
			"refunded",
		);
		calls = await callsOf(payment.id);
		expect(calls.filter((c) => c.owner === "shop").map((c) => c.hook)).toEqual(
			expect.arrayContaining(["onPaid", "onRefunded"]),
		);
		expect(calls).toHaveLength(3);
	});

	it("ignores changes that are not allowed from the current status", async () => {
		const payment = await insertPayment();
		expect(
			await applyPaymentChange(payment, "refunded", { providerEventId: "e" }),
		).toEqual({ applied: false, reason: "refunded not allowed from pending" });
		expect(await callsOf(payment.id)).toEqual([]);
	});

	it("answers 200 for events it does not track and for unknown payments", async () => {
		setPaymentProvider(stripeProvider());
		const other = signed({
			id: "evt_x",
			object: "event",
			type: "customer.created",
			data: { object: { id: "cus_1", object: "customer" } },
		});
		expect(
			(await handlePaymentWebhook("stripe", other.body, other.headers)).status,
		).toBe(200);
		const unknown = signed(
			sessionEvent("checkout.session.completed", crypto.randomUUID()),
		);
		expect(
			(await handlePaymentWebhook("stripe", unknown.body, unknown.headers))
				.status,
		).toBe(200);
	});
});

describe("handler calls", () => {
	const shopHandlers = (onPaid: PaymentHandlers["onPaid"]) => ({
		id: "shop",
		payments: { order: { onPaid } satisfies PaymentHandlers },
	});

	it("calls the owning module's named handler, also for a module that is not active", async () => {
		const onPaid = vi.fn(async () => {});
		// The resolver searches the modules it is given; core passes ALL registered modules.
		const modules = [shopHandlers(onPaid)];
		const payment = await insertPayment();
		await applyPaymentChange(payment, "paid", { providerEventId: "evt" });
		const now = new Date(Date.now() + 1000);
		await processHandlerCallsOnce(
			(call) =>
				call.kind === "payments" && call.owner !== "core"
					? resolvePaymentHandler(modules, call)
					: async () => {},
			now,
		);
		expect(onPaid).toHaveBeenCalledTimes(1);
		expect(onPaid.mock.calls[0]).toMatchObject([
			{ id: payment.id, refId: payment.refId, change: "paid" },
			{ now: expect.any(Date) },
		]);
		const call = await handlerCallsService.getByDedupeKey(
			`payment:${payment.id}:paid`,
		);
		expect(call?.status).toBe("done");
	});

	it("resolves the registry's handlers by name (events tickets, core receipt)", () => {
		for (const call of [
			{ owner: "events", kind: "payments", type: "tickets", hook: "onPaid" },
			{ owner: "events", kind: "payments", type: "tickets", hook: "onExpired" },
			{ owner: "core", kind: "payments", type: "receipt", hook: "onPaid" },
		])
			expect(resolveHandlerCall(call)).toBeTypeOf("function");
		// A declared kind without that hook is a no-op; an unknown kind is not resolved.
		expect(
			resolveHandlerCall({
				owner: "events",
				kind: "payments",
				type: "tickets",
				hook: "onRenewed",
			}),
		).toBeTypeOf("function");
		expect(
			resolveHandlerCall({
				owner: "events",
				kind: "payments",
				type: "nope",
				hook: "onPaid",
			}),
		).toBeUndefined();
	});

	it("retries a failing handler and lists it as failing", async () => {
		const onPaid = vi.fn(async (): Promise<void> => {
			throw new Error("ticket service down");
		});
		const modules = [shopHandlers(onPaid)];
		const payment = await insertPayment();
		await applyPaymentChange(payment, "paid", { providerEventId: "evt" });
		const resolve = (call: Parameters<typeof resolvePaymentHandler>[1]) =>
			call.owner === "core"
				? async () => {}
				: resolvePaymentHandler(modules, call);
		const now = new Date(Date.now() + 1000);
		await processHandlerCallsOnce(resolve, now);
		const key = `payment:${payment.id}:paid`;
		let call = await handlerCallsService.getByDedupeKey(key);
		expect(call).toMatchObject({
			status: "pending",
			attempts: 1,
			lastError: "ticket service down",
		});
		expect(
			(await handlerCallsService.listFailing()).map((c) => c.dedupeKey),
		).toContain(key);

		// After the backoff it runs again; once it succeeds it is done.
		onPaid.mockImplementation(async () => {});
		await processHandlerCallsOnce(resolve, new Date(now.getTime() + 60_000));
		call = await handlerCallsService.getByDedupeKey(key);
		expect(call).toMatchObject({ status: "done", attempts: 2 });
		expect(onPaid).toHaveBeenCalledTimes(2);
	});
});

describe("expiry schedule", () => {
	it("expires only pending checkouts past their expiry and queues onExpired", async () => {
		const provider = fakeProvider({
			expireCheckout: vi.fn(async (ref: string) => ref !== "cs_completed"),
		});
		setPaymentProvider(provider);
		const now = new Date("2030-01-01T12:00:00Z");
		const past = new Date(now.getTime() - 60_000).toISOString();
		const stale = await insertPayment({ expiresAt: past });
		const fresh = await insertPayment({
			expiresAt: new Date(now.getTime() + 60_000).toISOString(),
		});
		const paid = await insertPayment({ expiresAt: past });
		await applyPaymentChange(paid, "paid", { providerEventId: "e" });
		const completedMeanwhile = await insertPayment({
			expiresAt: past,
			providerRef: "cs_completed",
		});

		const { expired } = await expireStalePayments(now);
		expect(expired).toContain(stale.id);
		expect(expired).not.toContain(fresh.id);
		expect(expired).not.toContain(paid.id);
		expect(expired).not.toContain(completedMeanwhile.id);
		expect((await paymentsService.getById(stale.id))?.status).toBe("expired");
		expect((await paymentsService.getById(fresh.id))?.status).toBe("pending");
		expect((await paymentsService.getById(paid.id))?.status).toBe("paid");
		expect((await paymentsService.getById(completedMeanwhile.id))?.status).toBe(
			"pending",
		);
		expect(provider.expireCheckout).toHaveBeenCalledWith(stale.providerRef);
		expect((await callsOf(stale.id)).map((c) => c.hook)).toEqual(["onExpired"]);

		// Running again changes nothing; a late payment of an expired checkout is kept.
		expect((await expireStalePayments(now)).expired).not.toContain(stale.id);
		const late = await applyPaymentChange(
			(await paymentsService.getById(stale.id)) as Payment,
			"paid",
			{ providerEventId: "evt_late" },
		);
		expect(late).toMatchObject({ applied: true, status: "paid" });
	});
});

describe("Stripe event mapping", () => {
	const map = (type: string, object: Record<string, unknown>) =>
		normalizeStripeEvent({
			id: "evt_1",
			type,
			data: { object },
		} as unknown as Stripe.Event);

	it("maps checkout sessions, refunds and subscription events", () => {
		const session = {
			id: "cs_1",
			client_reference_id: "p1",
			metadata: { paymentId: "p1" },
			mode: "payment",
			payment_status: "paid",
			payment_intent: "pi_1",
		};
		expect(map("checkout.session.completed", session)).toMatchObject({
			change: "paid",
			paymentId: "p1",
			providerRef: "cs_1",
			providerPaymentRef: "pi_1",
		});
		expect(
			map("checkout.session.completed", {
				...session,
				payment_status: "unpaid",
			}).change,
		).toBeNull();
		expect(
			map("checkout.session.async_payment_succeeded", session).change,
		).toBe("paid");
		expect(map("checkout.session.async_payment_failed", session).change).toBe(
			"failed",
		);
		expect(map("checkout.session.expired", session).change).toBe("expired");
		expect(
			map("checkout.session.completed", {
				...session,
				mode: "subscription",
				payment_status: "paid",
				subscription: "sub_1",
			}),
		).toMatchObject({ change: "paid", providerPaymentRef: "sub_1" });

		expect(
			map("charge.refunded", { refunded: true, payment_intent: "pi_1" }),
		).toMatchObject({ change: "refunded", providerPaymentRef: "pi_1" });
		// A partial refund does not change the status.
		expect(
			map("charge.refunded", { refunded: false, payment_intent: "pi_1" })
				.change,
		).toBeNull();

		const invoice = (billing_reason: string) => ({
			id: "in_1",
			billing_reason,
			parent: {
				subscription_details: {
					subscription: "sub_1",
					metadata: { paymentId: "p1" },
				},
			},
		});
		expect(map("invoice.paid", invoice("subscription_cycle"))).toMatchObject({
			change: "renewed",
			paymentId: "p1",
			providerPaymentRef: "sub_1",
			occurrence: "in_1",
		});
		// The first invoice is part of the checkout, not a renewal.
		expect(
			map("invoice.paid", invoice("subscription_create")).change,
		).toBeNull();
		expect(
			map("invoice.payment_failed", invoice("subscription_cycle")),
		).toMatchObject({ change: "payment_failed", occurrence: "in_1" });
		expect(
			map("customer.subscription.deleted", {
				id: "sub_1",
				metadata: { paymentId: "p1" },
			}),
		).toMatchObject({
			change: "canceled",
			paymentId: "p1",
			providerPaymentRef: "sub_1",
		});
		expect(map("payment_intent.created", {}).change).toBeNull();
	});

	it("applies subscription cycles: each renewal once, failures to past_due, cancel", async () => {
		const payment = await insertPayment({ mode: "subscription" });
		await applyPaymentChange(payment, "paid", {
			providerEventId: "e1",
			providerPaymentRef: "sub_x",
		});
		let row = await paymentsService.getById(payment.id);
		expect(row?.status).toBe("active");
		expect(row?.providerPaymentRef).toBe("sub_x");

		const renew = (invoice: string) =>
			applyPaymentChange(row as Payment, "renewed", {
				providerEventId: `evt_${invoice}`,
				occurrence: invoice,
			});
		expect((await renew("in_1")).applied).toBe(true);
		expect((await renew("in_1")).applied).toBe(false);
		row = await paymentsService.getById(payment.id);
		expect(
			await applyPaymentChange(row as Payment, "payment_failed", {
				providerEventId: "evt_f",
				occurrence: "in_2",
			}),
		).toMatchObject({ applied: true, status: "past_due" });
		row = await paymentsService.getById(payment.id);
		expect((await renew("in_3")).applied).toBe(true);
		row = await paymentsService.getById(payment.id);
		expect(
			await applyPaymentChange(row as Payment, "canceled", {
				providerEventId: "evt_c",
			}),
		).toMatchObject({ applied: true, status: "canceled" });

		const hooks = (await callsOf(payment.id))
			.filter((c) => c.owner === "shop")
			.map((c) => c.hook)
			.sort();
		expect(hooks).toEqual(
			[
				"onCanceled",
				"onPaid",
				"onPaymentFailed",
				"onRenewed",
				"onRenewed",
			].sort(),
		);
		// A receipt for the first payment and for each renewal.
		expect(
			(await callsOf(payment.id)).filter((c) => c.owner === "core"),
		).toHaveLength(3);
	});
});
