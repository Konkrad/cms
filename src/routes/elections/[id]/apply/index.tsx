import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";
import { ApplyView } from "~theme/routes/elections/ApplyView";

export const useApplyData = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);

  const cycle = await electionsService.getCycleById(event.params.id);
  if (!cycle || (cycle.status !== "open")) throw event.redirect(302, `/elections/${event.params.id}`);

  const positionId = event.url.searchParams.get("positionId");
  const position = positionId ? cycle.positions.find((p) => p.id === positionId) : null;
  if (!position) throw event.redirect(302, `/elections/${event.params.id}`);

  if (cycle.requiredMembershipTier) {
    const { membershipsService } = await import("~/services/memberships.service");
    const hasAccess = await membershipsService.hasTier(user.id, cycle.requiredMembershipTier);
    if (!hasAccess) throw event.redirect(302, `/elections/${event.params.id}`);
  }

  return { cycle, position, userId: user.id };
});

export const useSubmitApplication = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);
    const result = await electionsService.createApplication({
      positionId: data.positionId,
      cycleId: data.cycleId,
      userId: user.id,
      motivationWhy: data.motivationWhy,
      motivationExperience: data.motivationExperience,
      motivationGoals: data.motivationGoals,
    });
    if (result.error) return { failed: true, error: result.error };
    throw event.redirect(302, `/elections/${data.cycleId}`);
  },
  zod$({
    positionId: z.string().uuid(),
    cycleId: z.string().uuid(),
    motivationWhy: z.string().min(10, "Please write at least a few sentences"),
    motivationExperience: z.string().min(10, "Please write at least a few sentences"),
    motivationGoals: z.string().min(10, "Please write at least a few sentences"),
  }),
);

export default component$(() => {
  const data = useApplyData();
  const submitAction = useSubmitApplication();
  return <ApplyView data={data.value} submitAction={submitAction} />;
});
