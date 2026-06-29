/**
 * Core → theme data contract for the onboarding/profile-setup route
 * (`/profile/setup`).
 */
import type { useOnboardingLoader } from "~/routes/profile/setup";
import type { useUpdateProfile } from "~/components/setup/ProfileStep/useUpdateProfile";
import type { useMarkLocation } from "~/components/setup/LocationStep/useMarkLocation";

export type OnboardingViewData = ReturnType<typeof useOnboardingLoader>["value"];
export type UpdateProfileAction = ReturnType<typeof useUpdateProfile>;
export type MarkLocationAction = ReturnType<typeof useMarkLocation>;
