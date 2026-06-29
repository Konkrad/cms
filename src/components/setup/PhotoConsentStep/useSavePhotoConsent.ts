import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action for the themed `PhotoConsentStep` widget
 * (`~theme/shared/PhotoConsentStep/PhotoConsentStep`) — re-export this from
 * any route that embeds it, via a RELATIVE import path (see
 * ../ProfileStep/useUpdateProfile.ts for why).
 * e.g. export { useSavePhotoConsent } from "../../../components/setup/PhotoConsentStep/useSavePhotoConsent";
 */
export const useSavePhotoConsent = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, { photoConsentGiven: data.given } as any);
    await markConsentStepComplete(user.id, "photoConsent");
    return { success: true };
  },
  zod$({ given: z.boolean() }),
);
