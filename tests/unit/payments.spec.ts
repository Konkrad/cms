import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { defineModule } from "~/core/modules";
import { dispatchPayment, handleStripeWebhook } from "~/core/payments";

const stripeEvent = (
	type: string,
	metadata: Record<string, string> = {},
): Stripe.Event =>
	({
		id: "evt_1",
		type,
		data: { object: { id: "pi_123", object: "payment_intent", metadata } },
	}) as unknown as Stripe.Event;

function fakeModules() {
	const shop = {
		onPaid: vi.fn(async () => {}),
		onFailed: vi.fn(async () => {}),
		onExpired: vi.fn(async () => {}),
	};
	const other = { onPaid: vi.fn(async () => {}) };
	const modules = [
		defineModule({ id: "alpha", payments: { shop } }),
		defineModule({ id: "beta", payments: { shop: other } }),
	];
	return { modules, shop, other };
}

describe("dispatchPayment", () => {
	it("routes by moduleId and kind, mapping event types to hooks", async () => {
		const { modules, shop, other } = fakeModules();
		const meta = { moduleId: "alpha", kind: "shop" };

		const paid = stripeEvent("payment_intent.succeeded", meta);
		expect(await dispatchPayment(modules, paid)).toEqual({
			handled: true,
			moduleId: "alpha",
			kind: "shop",
			hook: "onPaid",
		});
		expect(shop.onPaid).toHaveBeenCalledWith({
			paymentIntent: paid.data.object,
			event: paid,
			idempotencyKey: "pi_123",
		});

		await dispatchPayment(
			modules,
			stripeEvent("payment_intent.payment_failed", meta),
		);
		await dispatchPayment(
			modules,
			stripeEvent("payment_intent.canceled", meta),
		);
		expect(shop.onFailed).toHaveBeenCalledTimes(1);
		expect(shop.onExpired).toHaveBeenCalledTimes(1);
		expect(other.onPaid).not.toHaveBeenCalled();
	});

	it("calls modules that are not active (caller passes all registered modules)", async () => {
		// The dispatcher has no notion of "active": whatever list it gets is searched.
		// The webhook passes `allModules`, so a deactivated module still gets its callback.
		const { modules, other } = fakeModules();
		await dispatchPayment(
			modules,
			stripeEvent("payment_intent.succeeded", {
				moduleId: "beta",
				kind: "shop",
			}),
		);
		expect(other.onPaid).toHaveBeenCalledTimes(1);
	});

	it("ignores missing or unknown metadata and unmapped event types", async () => {
		const { modules, shop, other } = fakeModules();
		for (const event of [
			stripeEvent("payment_intent.succeeded"),
			stripeEvent("payment_intent.succeeded", { moduleId: "alpha" }),
			stripeEvent("payment_intent.succeeded", {
				moduleId: "nope",
				kind: "shop",
			}),
			stripeEvent("payment_intent.succeeded", {
				moduleId: "alpha",
				kind: "nope",
			}),
			stripeEvent("charge.refunded", { moduleId: "alpha", kind: "shop" }),
		]) {
			expect(await dispatchPayment(modules, event)).toMatchObject({
				handled: false,
			});
		}
		// A known kind without the hook is not handled either.
		expect(
			await dispatchPayment(
				modules,
				stripeEvent("payment_intent.canceled", {
					moduleId: "beta",
					kind: "shop",
				}),
			),
		).toMatchObject({ handled: false });
		expect(shop.onPaid).not.toHaveBeenCalled();
		expect(other.onPaid).not.toHaveBeenCalled();
	});

	it("propagates handler errors", async () => {
		const modules = [
			defineModule({
				id: "alpha",
				payments: {
					shop: {
						onPaid: async () => {
							throw new Error("boom");
						},
					},
				},
			}),
		];
		await expect(
			dispatchPayment(
				modules,
				stripeEvent("payment_intent.succeeded", {
					moduleId: "alpha",
					kind: "shop",
				}),
			),
		).rejects.toThrow("boom");
	});
});

describe("handleStripeWebhook", () => {
	const paid = stripeEvent("payment_intent.succeeded", {
		moduleId: "alpha",
		kind: "shop",
	});

	it("never dispatches without a signature", async () => {
		const verify = vi.fn(() => paid);
		const dispatch = vi.fn();
		const res = await handleStripeWebhook({
			body: "{}",
			signature: null,
			verify,
			dispatch,
		});
		expect(res.status).toBe(400);
		expect(verify).not.toHaveBeenCalled();
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("never dispatches when verification fails", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const dispatch = vi.fn();
		const res = await handleStripeWebhook({
			body: "{}",
			signature: "bad",
			verify: () => {
				throw new Error("No signatures found matching the expected signature");
			},
			dispatch,
		});
		expect(res).toEqual({ status: 400, body: { error: "Invalid signature" } });
		expect(dispatch).not.toHaveBeenCalled();
	});

	it("verifies first, then dispatches the verified event", async () => {
		const order: string[] = [];
		const res = await handleStripeWebhook({
			body: "raw",
			signature: "sig",
			verify: (body, signature) => {
				order.push(`verify:${body}:${signature}`);
				return paid;
			},
			dispatch: async (event) => {
				order.push(`dispatch:${event.id}`);
				return {
					handled: true,
					moduleId: "alpha",
					kind: "shop",
					hook: "onPaid",
				};
			},
		});
		expect(res).toEqual({ status: 200, body: { received: true } });
		expect(order).toEqual(["verify:raw:sig", "dispatch:evt_1"]);
	});

	it("answers 200 for unknown metadata so Stripe stops retrying", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const { modules, shop } = fakeModules();
		const res = await handleStripeWebhook({
			body: "{}",
			signature: "sig",
			verify: () => stripeEvent("payment_intent.succeeded", { moduleId: "x" }),
			dispatch: (event) => dispatchPayment(modules, event),
		});
		expect(res.status).toBe(200);
		expect(shop.onPaid).not.toHaveBeenCalled();
	});

	it("answers 500 when the handler fails so Stripe retries", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await handleStripeWebhook({
			body: "{}",
			signature: "sig",
			verify: () => paid,
			dispatch: async () => {
				throw new Error("db down");
			},
		});
		expect(res.status).toBe(500);
	});

	it("works with Stripe's real signature check: tampered bodies never dispatch", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const secret = "whsec_test";
		const payload = JSON.stringify(paid);
		const signature = Stripe.webhooks.generateTestHeaderString({
			payload,
			secret,
		});
		const verify = (body: string, sig: string) =>
			Stripe.webhooks.constructEvent(body, sig, secret);
		const dispatch = vi.fn(async () => ({
			handled: false as const,
			reason: "test",
		}));

		const tampered = payload.replace("pi_123", "pi_666");
		expect(
			(
				await handleStripeWebhook({
					body: tampered,
					signature,
					verify,
					dispatch,
				})
			).status,
		).toBe(400);
		expect(dispatch).not.toHaveBeenCalled();

		expect(
			(
				await handleStripeWebhook({
					body: payload,
					signature,
					verify,
					dispatch,
				})
			).status,
		).toBe(200);
		expect(dispatch).toHaveBeenCalledTimes(1);
	});
});
