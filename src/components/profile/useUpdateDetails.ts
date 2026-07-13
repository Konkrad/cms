import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";

/**
 * Co-located server action for the themed `ProfileDetailsEdit` widget
 * (`~theme/shared/ProfileDetailsEdit/ProfileDetailsEdit`) — re-export this
 * from any route that embeds it, via a RELATIVE import path (see
 * useUpdateName.ts for why).
 * e.g. export { useUpdateDetails } from "../../components/profile/useUpdateDetails";
 */
export const useUpdateDetails = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      yearOfBirth: data.year_of_birth ?? null,
      sex: data.sex || null,
    });
    return { success: true };
  },
  zod$({
    year_of_birth: z.coerce.number().optional(),
    sex: z.string().optional(),
  }),
);
