import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";

export const useElections = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(event);
  const all = await electionsService.getPublicCycles();
  const open = all.filter((c) => c.status === "open" || c.status === "voting");
  if (open.length > 0) throw event.redirect(302, `/elections/${open[0].id}`);
  return { cycles: open };
});

export default component$(() => {
  const data = useElections();

  return (
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold text-gray-900">Board Elections</h1>
        <Link href="/elections/mine" class="text-sm text-blue-600 hover:text-blue-800">
          My Applications →
        </Link>
      </div>

      {data.value.cycles.length === 0 ? (
        <div class="text-center py-16 text-gray-500">
          <p class="text-lg font-medium">No elections are currently open.</p>
          <p class="text-sm mt-2">Check back later or view your past applications above.</p>
        </div>
      ) : (
        <div class="space-y-4">
          {data.value.cycles.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/elections/${cycle.id}`}
              class="block bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Applications open
                    </span>
                  </div>
                  <h2 class="text-lg font-semibold text-gray-900">{cycle.title}</h2>
                  {cycle.description && (
                    <p class="text-sm text-gray-600 mt-1">{cycle.description}</p>
                  )}
                  {cycle.requiredMembershipTier && (
                    <p class="text-xs text-amber-700 mt-2">
                      Requires {cycle.requiredMembershipTier === "full" ? "Full Member" : "Associated Member"} status to apply
                    </p>
                  )}
                </div>
                <span class="text-sm text-blue-600 font-medium ml-4 shrink-0">View & Apply →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
