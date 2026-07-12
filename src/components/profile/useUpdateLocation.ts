import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/utils/server-auth";
import { usersService } from "~/services/users.service";

/**
 * Co-located server action for the themed `ProfileLocationEdit` widget
 * (`~theme/shared/ProfileLocationEdit/ProfileLocationEdit`) — re-export this
 * from any route that embeds it, via a RELATIVE import path (see
 * useUpdateName.ts for why).
 * e.g. export { useUpdateLocation } from "../../components/profile/useUpdateLocation";
 */
export const useUpdateLocation = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    await usersService.update(user.id, {
      city: data.city || null,
      country: data.country || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    });
    return { success: true };
  },
  zod$({
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
  }),
);
