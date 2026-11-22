import { resolvePaymentHandler } from "~/core/payments/handlers";
import { PAYMENT_HANDLER_KIND } from "~/core/payments/payments";
import { coreReviewHandlers } from "~/core/reviews/core-handlers";
import type { ReviewDecision, ReviewHandlers } from "~/core/reviews/define";
import type { HandlerResolver } from "~/core/scheduler/handler-calls";
import { allModules } from "./manifests";

/**
 * The review definition (rules and handlers) of an item type: core's own for `core`, else the
 * module manifest's `reviews[type]`, of every registered module (inactive ones too).
 */
export function reviewTypeDefinition(
	owner: string,
	type: string,
): ReviewHandlers | undefined {
	return owner === "core"
		? coreReviewHandlers[type]
		: allModules.find((m) => m.id === owner)?.reviews?.[type];
}

/**
 * Resolves a queued handler call to the function it names. Review and payment handlers of
 * core and of EVERY registered module (not only active ones): a decision made or a payment
 * completed after a module was deactivated is still carried out.
 */
export const resolveHandlerCall: HandlerResolver = (call) => {
	if (call.kind === PAYMENT_HANDLER_KIND)
		return resolvePaymentHandler(allModules, call);
	if (call.kind !== "reviews") return undefined;
	if (call.hook !== "onApproved" && call.hook !== "onRejected")
		return undefined;
	const handlers = reviewTypeDefinition(call.owner, call.type);
	const handler = handlers?.[call.hook];
	if (!handler) return undefined;
	return (payload) =>
		handler.call(
			handlers,
			{ now: new Date() },
			payload as unknown as ReviewDecision,
		);
};
