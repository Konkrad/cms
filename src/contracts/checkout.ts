/**
 * Core → theme data contracts for the event checkout flow (`/events/:id/checkout`, src/modules/events).
 */
import type { useCreateCheckoutSession } from "~/modules/events/actions";
import type { CheckoutPageData } from "~/modules/events/public-checkout";

export type CheckoutData = CheckoutPageData;
export type CreateCheckoutSessionAction = ReturnType<
	typeof useCreateCheckoutSession
>;
export type { SubmitRequirementAction } from "~/contracts/requirements";
