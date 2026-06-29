import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { MyApplicationsViewData } from "~/contracts/elections";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-warning-bg text-warning",
    approved: "bg-success-bg text-success",
    rejected: "bg-error-bg text-error",
  };
  return `inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-bg-muted text-text"}`;
};

/** Themed view for the user's own election applications (`/elections/mine`). */
export const MyApplicationsView = component$<{ data: MyApplicationsViewData }>(
  ({ data }) => {
    return (
      <div class="max-w-3xl mx-auto px-4 py-8">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-text-heading">My Election Applications</h1>
          <Link href="/elections" class="text-sm text-primary hover:text-primary">
            View elections →
          </Link>
        </div>

        {data.groups.length === 0 ? (
          <div class="text-center py-16 text-text-muted">
            You haven't applied for any board positions yet.
          </div>
        ) : (
          <div class="space-y-6">
            {data.groups.map(({ cycle, apps }) => (
              <div key={cycle.id} class="bg-white rounded-lg border border-border overflow-hidden">
                <div class="px-5 py-3 bg-bg border-b flex items-center justify-between">
                  <h2 class="font-semibold text-text-heading">{cycle.title}</h2>
                  <Link
                    href={`/elections/${cycle.id}`}
                    class="text-xs text-primary hover:text-primary"
                  >
                    View election →
                  </Link>
                </div>
                <ul class="divide-y divide-gray-100">
                  {apps.map((app) => (
                    <li key={app.id} class="px-5 py-4">
                      <div class="flex items-start justify-between">
                        <div>
                          <div class="text-sm font-medium text-text-heading">
                            {(app as any).position?.title}
                          </div>
                          <div class="text-xs text-text-muted mt-0.5">
                            Applied {app.createdAt.slice(0, 10)}
                          </div>
                        </div>
                        <span class={statusBadge(app.status)}>{app.status}</span>
                      </div>
                      {app.status === "rejected" && app.adminNote && (
                        <div class="mt-2 text-sm text-text-secondary bg-error-bg border border-error-border rounded px-3 py-2">
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
