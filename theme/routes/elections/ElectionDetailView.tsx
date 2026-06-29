import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import type { ElectionDetailViewData } from "~/contracts/elections";

/** Themed view for a single election cycle (`/elections/[id]`). */
export const ElectionDetailView = component$<{ data: ElectionDetailViewData }>(({ data }) => {
  const { cycle, approvedApps, userCanApply, userAppPositionIds } = data;
  const userAppSet = new Set(userAppPositionIds);

  const isOpen = cycle.status === "open";
  const isVoting = cycle.status === "voting";

  const windowBannerText = isOpen
    ? "✓ Applications are currently open."
    : isVoting
      ? "⬤ Voting is in progress — applications are closed."
      : "Applications for this election are closed.";

  const windowBannerClass = isOpen
    ? "bg-green-50 border-green-200 text-green-800"
    : isVoting
      ? "bg-blue-50 border-blue-200 text-blue-800"
      : "bg-slate-50 border-slate-200 text-slate-700";

  return (
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="mt-3 mb-2">
        <h1 class="text-3xl font-bold text-gray-900">{cycle.title}</h1>
        {cycle.description && <p class="text-gray-600 mt-2">{cycle.description}</p>}
      </div>

      {/* Application window banner */}
      <div class={`my-5 px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-between gap-4 ${windowBannerClass}`}>
        <span>{windowBannerText}</span>
        {isVoting && (cycle as any).votingUrl && (
          <a
            href={(cycle as any).votingUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-blue-700"
          >
            Vote now →
          </a>
        )}
      </div>

      {isOpen && !userCanApply && cycle.requiredMembershipTier && (
        <div class="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          You need at least{" "}
          <strong>{cycle.requiredMembershipTier === "full" ? "Full Member" : "Associated Member"}</strong>{" "}
          status to apply for this election.
        </div>
      )}

      <div class="space-y-8">
        {cycle.positions.map((position) => {
          const candidates = approvedApps.filter((a) => a.positionId === position.id);
          const hasApplied = userAppSet.has(position.id);
          return (
            <div key={position.id} class="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Position header */}
              <div class="px-5 py-4 bg-gray-50 border-b flex items-center justify-between">
                <div>
                  <h2 class="font-semibold text-gray-900 text-lg">{position.title}</h2>
                  {position.description && (
                    <p class="text-sm text-gray-600 mt-0.5">{position.description}</p>
                  )}
                </div>
                {isOpen && (
                  hasApplied ? (
                    <span class="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full shrink-0">
                      ✓ Applied
                    </span>
                  ) : userCanApply ? (
                    <Link
                      href={`/elections/${cycle.id}/apply?positionId=${position.id}`}
                      class="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 shrink-0"
                    >
                      Apply
                    </Link>
                  ) : null
                )}
              </div>

              {/* Candidates */}
              {candidates.length === 0 ? (
                <div class="px-5 py-5 text-sm text-gray-400 italic">No candidates yet.</div>
              ) : (
                <div class="divide-y divide-gray-100">
                  {candidates.map((app) => (
                    <div key={app.id} class="px-5 py-5">
                      <Link
                        href={`/users/${(app as any).user?.id}`}
                        class="font-semibold text-blue-600 hover:underline mb-3 inline-block"
                      >
                        {(app as any).user?.name} {(app as any).user?.familyName}
                      </Link>
                      <dl class="space-y-3 text-sm">
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Why they want this role</dt>
                          <dd class="text-gray-800 whitespace-pre-wrap">{(app as any).motivationWhy}</dd>
                        </div>
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Relevant experience</dt>
                          <dd class="text-gray-800 whitespace-pre-wrap">{(app as any).motivationExperience}</dd>
                        </div>
                        <div>
                          <dt class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">What they want to achieve</dt>
                          <dd class="text-gray-800 whitespace-pre-wrap">{(app as any).motivationGoals}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div class="mt-6 text-sm text-gray-500">
        <Link href="/elections/mine" class="text-blue-600 hover:text-blue-800">
          View my applications →
        </Link>
      </div>
    </div>
  );
});
