import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";
import { membershipsService } from "~/services/memberships.service";

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
  const { cycle, approvedApps, userCanApply, userAppPositionIds } = data.value;
  const userAppSet = new Set(userAppPositionIds);

  return (
    <div class="max-w-3xl mx-auto px-4 py-8">
      <Link href="/elections" class="text-sm text-gray-500 hover:text-gray-700">← Elections</Link>
      <div class="flex items-center justify-between mt-2 mb-2">
        <h1 class="text-3xl font-bold text-gray-900">{cycle.title}</h1>
        <span
          class={[
            "inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize",
            cycle.status === "open" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700",
          ].join(" ")}
        >
          {cycle.status}
        </span>
      </div>
      {cycle.description && <p class="text-gray-600 mb-6">{cycle.description}</p>}

      {cycle.status === "open" && !userCanApply && cycle.requiredMembershipTier && (
        <div class="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          You need at least{" "}
          <strong>{cycle.requiredMembershipTier === "full" ? "Full Member" : "Associated Member"}</strong>{" "}
          status to apply for this election.
        </div>
      )}

      <div class="space-y-6">
        {cycle.positions.map((position) => {
          const candidates = approvedApps.filter((a) => a.positionId === position.id);
          const hasApplied = userAppSet.has(position.id);
          return (
            <div key={position.id} class="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div class="px-5 py-4 bg-gray-50 border-b flex items-center justify-between">
                <div>
                  <h2 class="font-semibold text-gray-900">{position.title}</h2>
                  {position.description && (
                    <p class="text-sm text-gray-600 mt-0.5">{position.description}</p>
                  )}
                </div>
                {cycle.status === "open" && (
                  hasApplied ? (
                    <span class="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                      Applied
                    </span>
                  ) : userCanApply ? (
                    <Link
                      href={`/elections/${cycle.id}/apply?positionId=${position.id}`}
                      class="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                    >
                      Apply
                    </Link>
                  ) : null
                )}
              </div>

              {candidates.length > 0 ? (
                <ul class="divide-y divide-gray-100">
                  {candidates.map((app) => (
                    <li key={app.id} class="px-5 py-3 text-sm text-gray-800">
                      {(app as any).user?.name} {(app as any).user?.familyName}
                    </li>
                  ))}
                </ul>
              ) : (
                <div class="px-5 py-4 text-sm text-gray-400">No approved candidates yet.</div>
              )}
            </div>
          );
        })}
      </div>

      <div class="mt-6">
        <Link href="/elections/mine" class="text-sm text-blue-600 hover:text-blue-800">
          View my applications →
        </Link>
      </div>
    </div>
  );
});
