/**
 * Core → theme data contracts for the event checkout flow (`/events/[id]/checkout`).
 */
import type {
  useProductsData,
  useCreateCheckoutSession,
  useCheckPaymentStatus,
} from "~/routes/events/[id]/checkout";
import type { useSaveFoodPreference } from "~/components/setup/FoodPreferenceStep/useSaveFoodPreference";
import type { useSavePhotoConsent } from "~/components/setup/PhotoConsentStep/useSavePhotoConsent";

export type CheckoutData = ReturnType<typeof useProductsData>["value"];
export type CreateCheckoutSessionAction = ReturnType<typeof useCreateCheckoutSession>;
export type CheckPaymentStatusAction = ReturnType<typeof useCheckPaymentStatus>;
export type SaveFoodPreferenceAction = ReturnType<typeof useSaveFoodPreference>;
export type SavePhotoConsentAction = ReturnType<typeof useSavePhotoConsent>;
