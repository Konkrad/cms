import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action for the themed `LocationStep` widget
 * (`~theme/shared/LocationStep/LocationStep`) — re-export this from any route
 * that embeds it, via a RELATIVE import path (see useUpdateProfile.ts for why).
 * e.g. export { useMarkLocation } from "../../../components/setup/LocationStep/useMarkLocation";
 */
export const useMarkLocation = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      city: data.city || null,
      country: data.country || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    });
    await markConsentStepComplete(user.id, "locationVerification");
    return { success: true };
  },
  zod$({
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  }),
);
