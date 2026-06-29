import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";
import { membershipsService } from "~/services/memberships.service";
import { ElectionDetailView } from "~theme/routes/elections/ElectionDetailView";

export const useElectionDetail = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);
  const [cycle, approvedApps] = await Promise.all([
    electionsService.getCycleById(event.params.id),
    electionsService.getApprovedApplicationsByCycle(event.params.id),
  ]);
  if (!cycle || cycle.status === "draft") throw event.redirect(302, "/elections");

  let userCanApply = cycle.status === "open";
  if (userCanApply && cycle.requiredMembershipTier) {
    userCanApply = await membershipsService.hasTier(user.id, cycle.requiredMembershipTier);
  }

  const userApplications = await electionsService.getApplicationsByUser(user.id);
  const userAppPositionIds = new Set(
    userApplications
      .filter((a) => a.cycleId === cycle.id)
      .map((a) => a.positionId),
  );

  return { cycle, approvedApps, userCanApply, userAppPositionIds: [...userAppPositionIds] };
});

export default component$(() => {
  const data = useElectionDetail();
  return <ElectionDetailView data={data.value} />;
});
