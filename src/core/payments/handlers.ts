import type {
	PaymentHandlerContext,
	PaymentHandlers,
	PaymentHook,
	PaymentInfo,
} from "~/core/payments/payments";
import type { HandlerCall } from "~/core/scheduler/schema";

/** Core's own payment handlers (`owner: "core"`): the generic receipt. */
export const corePaymentHandlers: Record<string, PaymentHandlers> = {
	receipt: {
		onPaid: async (payment) =>
			(await import("~/core/payments/receipt")).sendReceipt(payment),
		onRenewed: async (payment) =>
			(await import("~/core/payments/receipt")).sendReceipt(payment),
	},
};

/**
 * Finds the payment handler a queued call names: `payments[type][hook]` of the owning module,
 * searched in EVERY registered module passed in (not only active ones: late payments and
 * renewals are never lost, spec 4.1), or core's. A kind the owner declares without that hook
 * resolves to a no-op (nothing to do); an unknown owner or kind resolves to undefined, so the
 * call is retried and listed as failing.
 */
export function resolvePaymentHandler(
	modules: ReadonlyArray<{
		id: string;
		payments?: Record<string, PaymentHandlers>;
	}>,
	call: Pick<HandlerCall, "owner" | "type" | "hook">,
): ((payload: Record<string, unknown>) => Promise<void>) | undefined {
	const handlers =
		call.owner === "core"
			? corePaymentHandlers[call.type]
			: modules.find((m) => m.id === call.owner)?.payments?.[call.type];
	if (!handlers) return undefined;
	const handler = handlers[call.hook as PaymentHook];
	if (!handler) return async () => {};
	const ctx: PaymentHandlerContext = { now: new Date() };
	return (payload) =>
		handler.call(handlers, payload as unknown as PaymentInfo, ctx);
}
