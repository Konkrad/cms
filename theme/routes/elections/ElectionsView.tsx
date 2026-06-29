import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { ElectionsViewData } from "~/contracts/elections";

/** Themed view for the public elections list (`/elections`). */
export const ElectionsView = component$<{ data: ElectionsViewData }>(({ data }) => {
  return (
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-3xl font-bold text-text-heading">Board Elections</h1>
        <Link href="/elections/mine" class="text-sm text-primary hover:text-primary">
          My Applications →
        </Link>
      </div>

      {data.cycles.length === 0 ? (
        <div class="text-center py-16 text-text-muted">
          <p class="text-lg font-medium">No elections are currently open.</p>
          <p class="text-sm mt-2">Check back later or view your past applications above.</p>
        </div>
      ) : (
        <div class="space-y-4">
          {data.cycles.map((cycle) => (
            <Link
              key={cycle.id}
              href={`/elections/${cycle.id}`}
              class="block bg-white rounded-lg border border-border p-5 hover:border-primary hover:shadow-sm transition-all"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success">
                      Applications open
                    </span>
                  </div>
                  <h2 class="text-lg font-semibold text-text-heading">{cycle.title}</h2>
                  {cycle.description && (
                    <p class="text-sm text-text-secondary mt-1">{cycle.description}</p>
                  )}
                  {cycle.requiredMembershipTier && (
                    <p class="text-xs text-warning mt-2">
                      Requires{" "}
                      {cycle.requiredMembershipTier === "full"
                        ? "Full Member"
                        : "Associated Member"}{" "}
                      status to apply
                    </p>
                  )}
                </div>
                <span class="text-sm text-primary font-medium ml-4 shrink-0">View & Apply →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
