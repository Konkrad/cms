import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { MyApplicationsViewData } from "~/contracts/elections";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-800"}`;
};

/** Themed view for the user's own election applications (`/elections/mine`). */
export const MyApplicationsView = component$<{ data: MyApplicationsViewData }>(
  ({ data }) => {
    return (
      <div class="max-w-3xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-gray-900">My Election Applications</h1>
          <Link href="/elections" class="text-sm text-blue-600 hover:text-blue-800">
            View elections →
          </Link>
        </div>

        {data.groups.length === 0 ? (
          <div class="text-center py-16 text-gray-500">
            You haven't applied for any board positions yet.
          </div>
        ) : (
          <div class="space-y-6">
            {data.groups.map(({ cycle, apps }) => (
              <div key={cycle.id} class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div class="px-5 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <h2 class="font-semibold text-gray-900">{cycle.title}</h2>
                  <Link
                    href={`/elections/${cycle.id}`}
                    class="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View election →
                  </Link>
                </div>
                <ul class="divide-y divide-gray-100">
                  {apps.map((app) => (
                    <li key={app.id} class="px-5 py-4">
                      <div class="flex items-start justify-between">
                        <div>
                          <div class="text-sm font-medium text-gray-900">
                            {(app as any).position?.title}
                          </div>
                          <div class="text-xs text-gray-400 mt-0.5">
                            Applied {app.createdAt.slice(0, 10)}
                          </div>
                        </div>
                        <span class={statusBadge(app.status)}>{app.status}</span>
                      </div>
                      {app.status === "rejected" && app.adminNote && (
                        <div class="mt-2 text-sm text-gray-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                          <span class="font-medium">Feedback: </span>
                          {app.adminNote}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
