import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";

export const useElectionsData = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/elections");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const cycles = await electionsService.getCycles();
  return { cycles };
});

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    open: "bg-green-100 text-green-800",
    closed: "bg-slate-100 text-slate-700",
  };
  return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-800"}`;
};

export default component$(() => {
  const data = useElectionsData();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Elections</h2>
        <Link
          href="/admin/global/elections/new"
          class="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
        >
          New Election Cycle
        </Link>
      </div>

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Required Tier</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.cycles.map((cycle) => (
              <tr key={cycle.id} class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm font-medium text-gray-900">{cycle.title}</td>
                <td class="px-6 py-4 text-sm text-gray-700">{cycle.year}</td>
                <td class="px-6 py-4">
                  <span class={statusBadge(cycle.status)}>{cycle.status}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 capitalize">
                  {cycle.requiredMembershipTier ?? "None"}
                </td>
                <td class="px-6 py-4 text-sm">
                  <Link
                    href={`/admin/global/elections/${cycle.id}`}
                    class="text-blue-600 hover:text-blue-900"
                  >
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.value.cycles.length === 0 && (
          <div class="text-center py-12 text-gray-500">No election cycles yet.</div>
        )}
      </div>
    </div>
  );
});
