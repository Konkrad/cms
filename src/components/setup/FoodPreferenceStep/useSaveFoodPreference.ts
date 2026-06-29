import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action for the themed `FoodPreferenceStep` widget
 * (`~theme/shared/FoodPreferenceStep/FoodPreferenceStep`) — re-export this from
 * any route that embeds it, via a RELATIVE import path (see
 * ../ProfileStep/useUpdateProfile.ts for why).
 * e.g. export { useSaveFoodPreference } from "../../../components/setup/FoodPreferenceStep/useSaveFoodPreference";
 */
export const useSaveFoodPreference = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, { foodPreference: data.preference || null });
    await markConsentStepComplete(user.id, "foodPreference");
    return { success: true };
  },
  zod$({
    preference: z.string().optional(),
  }),
);
