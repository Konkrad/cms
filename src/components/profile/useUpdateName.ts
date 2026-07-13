import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";

/**
 * Co-located server action for the themed `ProfileNameEdit` widget
 * (`~theme/shared/ProfileNameEdit/ProfileNameEdit`) — re-export this from any
 * route that embeds it, via a RELATIVE import path. qwikRouter's production
 * transform for re-exported routeAction$/routeLoader$ does not resolve the
 * tsconfig "~" alias (or "~theme"), so the Rollup build fails to find the
 * module if imported through either alias.
 * e.g. export { useUpdateName } from "../../components/profile/useUpdateName";
 */
export const useUpdateName = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      name: data.name,
      familyName: data.family_name,
    });
    return { success: true };
  },
  zod$({
    name: z.string().min(1, "Name is required"),
    family_name: z.string().min(1, "Family name is required"),
  }),
);
