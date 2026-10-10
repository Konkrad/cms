/**
 * Core → theme data contracts for the event checkout flow (`/events/:id/checkout`, modules/events).
 */
import type { useSaveFoodPreference } from "~/components/setup/FoodPreferenceStep/useSaveFoodPreference";
import type { useSavePhotoConsent } from "~/components/setup/PhotoConsentStep/useSavePhotoConsent";
import type {
	useCheckPaymentStatus,
	useCreateCheckoutSession,
} from "~modules/events/actions";
import type { CheckoutPageData } from "~modules/events/public-checkout";

export type CheckoutData = CheckoutPageData;
export type CreateCheckoutSessionAction = ReturnType<
	typeof useCreateCheckoutSession
>;
export type CheckPaymentStatusAction = ReturnType<typeof useCheckPaymentStatus>;
export type SaveFoodPreferenceAction = ReturnType<typeof useSaveFoodPreference>;
export type SavePhotoConsentAction = ReturnType<typeof useSavePhotoConsent>;
