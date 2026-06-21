import {
  component$,
  useSignal,
  useVisibleTask$,
  useOnWindow,
  $,
} from "@qwik.dev/core";
import { Link, routeLoader$, server$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { CursorPager } from "~/components/ui/CursorPager";
import { jobsService } from "~/services/jobs.service";
import type { JobWithUser } from "~/services/jobs.service";

const PAGE_SIZE = 10;

export const useJobs = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(event);
  const { items, nextCursor } = await jobsService.getApprovedPaged(PAGE_SIZE);
  return { jobs: items, nextCursor };
});

const fetchJobsPage = server$(async function (cursor: string | null) {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(this as any);
  return jobsService.getApprovedPaged(PAGE_SIZE, cursor);
});

function locationLabel(job: { locationType: string; city?: string | null; country?: string | null }) {
  if (job.locationType === "on-site") {
    return [job.city, job.country].filter(Boolean).join(", ") || "On-site / Hybrid";
  }
  if (job.locationType === "remote-eu") return "Remote — EU";
  return `Remote — ${job.country ?? ""}`;
}

export default component$(() => {
  const data = useJobs();

  // Seed signals from SSR loader
  const displayedJobs = useSignal<JobWithUser[]>(data.value.jobs);
  const cursors = useSignal<(string | null)[]>(
    data.value.nextCursor ? [null, data.value.nextCursor] : [null],
  );
  const currentPage = useSignal(1);
  const isLoading = useSignal(false);

  const jobs = displayedJobs.value;
  const totalKnownPages = cursors.value.length;

  // Fetch and render a page we already have a cursor for (no URL side effects).
  const loadPage = $(async (page: number) => {
    if (page === currentPage.value) return;
    // Page 1 is the SSR-rendered data — restore it without refetching.
    if (page === 1) {
      displayedJobs.value = data.value.jobs;
      currentPage.value = 1;
      return;
    }
    isLoading.value = true;
    try {
      const result = await fetchJobsPage(cursors.value[page - 1] ?? null);
      displayedJobs.value = result.items;
      currentPage.value = page;
      if (result.nextCursor && cursors.value.length <= page) {
        cursors.value = [...cursors.value, result.nextCursor];
      }
    } finally {
      isLoading.value = false;
    }
  });

  // User clicked a page: load it and push a history entry so the URL reflects
  // the page and the browser back button returns to the previous page.
  const goToPage = $(async (page: number) => {
    if (page === currentPage.value) return;
    await loadPage(page);
    const url = new URL(window.location.href);
    if (page <= 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(page));
    window.history.pushState({ page }, "", url);
  });

  // Browser back/forward: re-render the page named in the URL using the cursor
  // we already walked to in this session.
  useOnWindow(
    "popstate",
    $(() => {
      const param = new URL(window.location.href).searchParams.get("page");
      const page = param ? Math.max(1, parseInt(param, 10) || 1) : 1;
      if (page !== currentPage.value && page <= cursors.value.length) {
        void loadPage(page);
      }
    }),
  );

  // Runs on every mount, including a remount after a full route navigation away and
  // back (e.g. clicking into a job then hitting browser back) — the routeLoader$
  // always reloads page 1 fresh, and the in-memory cursor chain from the old
  // instance is gone. If the URL names a page beyond 1 we replay fetches in order
  // to rebuild the chain and land back on that page, rather than silently falling
  // back to page 1.
  useVisibleTask$(async () => {
    const requestedPage = (() => {
      const param = new URL(window.location.href).searchParams.get("page");
      const n = param ? parseInt(param, 10) : 1;
      return Number.isFinite(n) && n > 1 ? n : 1;
    })();
    if (requestedPage === 1) return;

    const newCursors: (string | null)[] = data.value.nextCursor
      ? [null, data.value.nextCursor]
      : [null];
    let landedPage = 1;
    isLoading.value = true;
    try {
      for (let p = 2; p <= requestedPage && newCursors[p - 1]; p++) {
        const result = await fetchJobsPage(newCursors[p - 1]);
        displayedJobs.value = result.items;
        landedPage = p;
        if (result.nextCursor) newCursors.push(result.nextCursor);
      }
      cursors.value = newCursors;
      currentPage.value = landedPage;

      // Fewer pages exist now than the URL claims — bring the URL back in sync.
      if (landedPage !== requestedPage) {
        const url = new URL(window.location.href);
        if (landedPage <= 1) url.searchParams.delete("page");
        else url.searchParams.set("page", String(landedPage));
        window.history.replaceState({ page: landedPage }, "", url);
      }
    } finally {
      isLoading.value = false;
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
        currentPage={currentPage.value}
        totalKnownPages={totalKnownPages}
        isLoading={isLoading.value}
        onPageChange$={goToPage}
      />

      <div class="mt-8 pt-8 border-t border-gray-200 text-center">
        <Link href="/jobs/mine" class="text-sm text-blue-600 hover:text-blue-800">
          View my submissions →
        </Link>
      </div>
    </div>
  );
});
