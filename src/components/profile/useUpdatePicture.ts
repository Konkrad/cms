import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";

/**
 * Co-located server action for the themed `ProfileAvatarEdit` widget
 * (`~theme/shared/ProfileAvatarEdit/ProfileAvatarEdit`) — re-export this from
 * any route that embeds it, via a RELATIVE import path (see useUpdateName.ts
 * for why).
 * e.g. export { useUpdatePicture } from "../../components/profile/useUpdatePicture";
 */
export const useUpdatePicture = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);

    if (!data.profilePicture && !data.profilePictureSmall) {
      return { success: false, error: "No image provided" };
    }

    // usersService.update itself re-validates these keys are under the
    // profile-picture prefixes the upload pipeline actually writes to
    // (they're later presigned server-side, so an arbitrary key would grant
    // a read URL for any private object) — no need to duplicate that check here.
    await usersService.update(user.id, {
      ...(data.profilePicture ? { profilePicture: data.profilePicture } : {}),
      ...(data.profilePictureSmall ? { profilePictureSmall: data.profilePictureSmall } : {}),
    });
    return { success: true };
  },
  zod$({
    profilePicture: z.string().optional(),
    profilePictureSmall: z.string().optional(),
  }),
);
