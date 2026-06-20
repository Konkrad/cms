import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
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

  const displayedJobs = useSignal<JobWithUser[]>([]);
  // cursors[0] = null (page 1), cursors[N-1] = cursor for page N
  const cursors = useSignal<(string | null)[]>([null]);
  const currentPage = useSignal(1);
  const isLoading = useSignal(false);

  // Seed initial state from SSR loader data
  useTask$(() => {
    displayedJobs.value = data.value.jobs;
    if (data.value.nextCursor) {
      cursors.value = [null, data.value.nextCursor];
    }
  });

  const goToPage = $(async (page: number) => {
    if (page === 1 && currentPage.value !== 1) {
      displayedJobs.value = data.value.jobs;
      currentPage.value = 1;
      return;
    }
    isLoading.value = true;
    try {
      const result = await fetchJobsPage(cursors.value[page - 1]);
      displayedJobs.value = result.items;
      currentPage.value = page;
      if (result.nextCursor && cursors.value.length <= page) {
        cursors.value = [...cursors.value, result.nextCursor];
      }
    } finally {
      isLoading.value = false;
    }
  });

  const jobs = currentPage.value === 1 ? data.value.jobs : displayedJobs.value;

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
        totalKnownPages={cursors.value.length}
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
