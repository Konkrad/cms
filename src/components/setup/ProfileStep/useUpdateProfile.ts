import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";
import { markConsentStepComplete } from "~/utils/onboarding";

/**
 * Co-located server action for the themed `ProfileStep` widget
 * (`~theme/shared/ProfileStep/ProfileStep`) — re-export this from any route
 * that embeds it, via a RELATIVE import path. qwikRouter's production
 * transform for re-exported routeAction$/routeLoader$ does not resolve the
 * tsconfig "~" alias (or "~theme"), so the Rollup build fails to find the
 * module if imported through either alias.
 * e.g. export { useUpdateProfile } from "../../../components/setup/ProfileStep/useUpdateProfile";
 */
export const useUpdateProfile = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      name: data.name,
      familyName: data.family_name,
      yearOfBirth: data.year_of_birth ?? null,
      sex: data.sex || null,
      ...(data.profilePicture ? { profilePicture: data.profilePicture } : {}),
      ...(data.profilePictureSmall ? { profilePictureSmall: data.profilePictureSmall } : {}),
    });
    await markConsentStepComplete(user.id, "lastProfileUpdate");
    return { success: true };
  },
  zod$({
    name: z.string().min(1, "Name is required"),
    family_name: z.string().min(1, "Family name is required"),
    year_of_birth: z.coerce.number().optional(),
    sex: z.string().optional(),
    profilePicture: z.string().optional(),
    profilePictureSmall: z.string().optional(),
  }),
);
