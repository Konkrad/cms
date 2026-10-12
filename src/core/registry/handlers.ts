import { coreReviewHandlers } from "~/core/reviews/core-handlers";
import type { ReviewDecision } from "~/core/reviews/define";
import type { HandlerResolver } from "~/core/scheduler/handler-calls";
import { allModules } from "./manifests";

/**
 * Resolves a queued handler call to the function it names. Review handlers of core and of
 * EVERY registered module (not only active ones): a decision made before a module was
 * deactivated is still carried out, like payment handlers.
 */
export const resolveHandlerCall: HandlerResolver = (call) => {
	if (call.kind !== "reviews") return undefined;
	if (call.hook !== "onApproved" && call.hook !== "onRejected")
		return undefined;
	const handlers =
		call.owner === "core"
			? coreReviewHandlers[call.type]
			: allModules.find((m) => m.id === call.owner)?.reviews?.[call.type];
	const handler = handlers?.[call.hook];
	if (!handler) return undefined;
	return (payload) =>
		handler.call(
			handlers,
			{ now: new Date() },
			payload as unknown as ReviewDecision,
		);
};
