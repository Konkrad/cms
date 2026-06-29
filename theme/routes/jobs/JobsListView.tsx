import {
  component$,
  useSignal,
  useVisibleTask$,
  useOnWindow,
  $,
} from "@qwik.dev/core";
import { Link, server$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { CursorPager } from "~/components/ui/CursorPager";
import { jobsService } from "~/services/jobs.service";
import type { JobWithUser } from "~/services/jobs.service";
import type { JobsListData } from "~/contracts/jobs";

const PAGE_SIZE = 10;

/**
 * Self-contained `server$` pagination fetcher, colocated with the interactive
 * UI it serves (same pattern as theme/blocks' self-fetching page blocks — see
 * theme/blocks/index.ts). The initial page comes from the route's SSR loader;
 * this only fetches subsequent pages on next/prev clicks.
 */
const fetchJobsPage = server$(async function (
  cursor: string | null,
  direction: "forward" | "backward",
) {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(this as any);
  return jobsService.getApprovedPaged(PAGE_SIZE, cursor, direction);
});

function locationLabel(job: { locationType: string; city?: string | null; country?: string | null }) {
  if (job.locationType === "on-site") {
    return [job.city, job.country].filter(Boolean).join(", ") || "On-site / Hybrid";
  }
  if (job.locationType === "remote-eu") return "Remote — EU";
  return `Remote — ${job.country ?? ""}`;
}

/** Themed view for the job board list (`/jobs`). */
export const JobsListView = component$<{ data: JobsListData }>(({ data }) => {
  // Seed signals from SSR loader
  const displayedJobs = useSignal<JobWithUser[]>(data.items);
  const nextCursor = useSignal<string | null>(data.nextCursor);
  const prevCursor = useSignal<string | null>(data.prevCursor);
  const isLoading = useSignal(false);

  const jobs = displayedJobs.value;

  // Cursors encode absolute DB sort-key coordinates, so a single query in
  // either direction (flipping the comparison/order, reversing backward
  // results) reproduces the adjacent page directly — no history of visited
  // pages required.
  const loadFromUrl = $(async () => {
    const url = new URL(window.location.href);
    const cursor = url.searchParams.get("cursor");
    if (!cursor) {
      displayedJobs.value = data.items;
      nextCursor.value = data.nextCursor;
      prevCursor.value = data.prevCursor;
      return;
    }
    const direction = url.searchParams.get("dir") === "prev" ? "backward" : "forward";
    isLoading.value = true;
    try {
      const result = await fetchJobsPage(cursor, direction);
      displayedJobs.value = result.items;
      nextCursor.value = result.nextCursor;
      prevCursor.value = result.prevCursor;
    } catch {
      // Invalid or expired cursor — fall back to the SSR-loaded first page.
      url.searchParams.delete("cursor");
      url.searchParams.delete("dir");
      window.history.replaceState({}, "", url);
      displayedJobs.value = data.items;
      nextCursor.value = data.nextCursor;
      prevCursor.value = data.prevCursor;
    } finally {
      isLoading.value = false;
    }
  });

  const goNext = $(async () => {
    const cursor = nextCursor.value;
    if (!cursor) return;
    isLoading.value = true;
    try {
      const result = await fetchJobsPage(cursor, "forward");
      displayedJobs.value = result.items;
      nextCursor.value = result.nextCursor;
      prevCursor.value = result.prevCursor;
      const url = new URL(window.location.href);
      url.searchParams.set("cursor", cursor);
      url.searchParams.delete("dir");
      window.history.pushState({}, "", url);
    } finally {
      isLoading.value = false;
    }
  });

  const goPrev = $(async () => {
    const cursor = prevCursor.value;
    if (!cursor) return;
    isLoading.value = true;
    try {
      const result = await fetchJobsPage(cursor, "backward");
      displayedJobs.value = result.items;
      nextCursor.value = result.nextCursor;
      prevCursor.value = result.prevCursor;
      const url = new URL(window.location.href);
      if (result.prevCursor === null) {
        // Landed back on the true first page — keep the URL canonical.
        url.searchParams.delete("cursor");
        url.searchParams.delete("dir");
      } else {
        url.searchParams.set("cursor", cursor);
        url.searchParams.set("dir", "prev");
      }
      window.history.pushState({}, "", url);
    } finally {
      isLoading.value = false;
    }
  });

  // Browser back/forward: re-derive the displayed page from the URL.
  useOnWindow(
    "popstate",
    $(() => {
      void loadFromUrl();
    }),
  );

  // Runs on every mount, including a remount after a full route navigation
  // away and back (e.g. clicking into a job then hitting browser back) — the
  // routeLoader$ always reloads the first page fresh. If the URL names a
  // cursor, fetch that exact page directly in one query.
  useVisibleTask$(async () => {
    if (new URL(window.location.href).searchParams.get("cursor")) {
      await loadFromUrl();
    }
  });

  return (
    <div class="max-w-3xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Job Board</h1>
        <Button href="/jobs/new">Post a Job</Button>
      </div>

      <div class="space-y-4">
        {jobs.map((job) => (
          <div
            key={job.id}
            class="bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <Link
                  href={`/jobs/${job.id}`}
                  class="text-lg font-semibold text-gray-900 hover:text-blue-600"
                >
                  {job.title}
                </Link>
                <div class="mt-1 text-sm text-gray-500">
                  {locationLabel(job)}
                </div>
              </div>
              {job.link && (
                <a
                  href={job.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="shrink-0 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Apply
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && (
        <div class="text-center py-16 text-gray-500">
          No job postings at the moment. Check back soon!
        </div>
      )}

      <CursorPager
        hasPrevious={prevCursor.value !== null}
        hasNext={nextCursor.value !== null}
        isLoading={isLoading.value}
        onPrevious$={goPrev}
        onNext$={goNext}
      />

      <div class="mt-8 pt-8 border-t border-gray-200 text-center">
        <Link href="/jobs/mine" class="text-sm text-blue-600 hover:text-blue-800">
          View my submissions →
        </Link>
      </div>
    </div>
  );
});
