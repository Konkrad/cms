import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";

export const useElections = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(event);
  const cycles = await electionsService.getPublicCycles();
  return { cycles };
});

export default component$(() => {
  const data = useElections();

  return (
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Board Elections</h1>
        <Link href="/elections/mine" class="text-sm text-blue-600 hover:text-blue-800">
          My Applications
        </Link>
      </div>

      {data.value.cycles.length === 0 ? (
        <div class="text-center py-16 text-gray-500">No elections are currently open or have recently closed.</div>
      ) : (
        <div class="space-y-4">
          {data.value.cycles.map((cycle) => (
            <div key={cycle.id} class="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900">{cycle.title}</h2>
                  {cycle.description && (
                    <p class="text-sm text-gray-600 mt-1">{cycle.description}</p>
                  )}
                  {cycle.requiredMembershipTier && (
                    <p class="text-xs text-amber-700 mt-1">
                      Requires {cycle.requiredMembershipTier === "full" ? "Full Member" : "Associated Member"} status to apply
                    </p>
                  )}
                </div>
                <div class="flex items-center gap-3 ml-4 shrink-0">
                  <span
                    class={[
                      "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                      cycle.status === "open"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-700",
                    ].join(" ")}
                  >
                    {cycle.status}
                  </span>
                  <Link
                    href={`/elections/${cycle.id}`}
                    class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {cycle.status === "open" ? "View & Apply →" : "View Candidates →"}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
