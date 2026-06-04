import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { format } from "date-fns";
import { jobsService } from "~/services/jobs.service";

export const useJob = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(event);

  const job = await jobsService.getById(event.params.id);
  const now = new Date().toISOString();

  if (!job || job.status !== "approved" || job.expiresAt < now) {
    throw event.error(404, "Job not found");
  }

  return { job };
});

function locationLabel(job: { locationType: string; city?: string | null; country?: string | null }) {
  if (job.locationType === "on-site") {
    return [job.city, job.country].filter(Boolean).join(", ") || "On-site";
  }
  if (job.locationType === "remote-eu") return "Remote — EU";
  return `Remote — ${job.country ?? ""}`;
}

export default component$(() => {
  const data = useJob();
  const job = data.value.job;

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="mb-6">
        <Link href="/jobs" class="text-sm text-blue-600 hover:text-blue-800">
          ← Back to Job Board
        </Link>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg p-8">
        <h1 class="text-2xl font-bold text-gray-900 mb-3">{job.title}</h1>

        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
          <span>{locationLabel(job)}</span>
          <span>·</span>
          <span>Expires {format(new Date(job.expiresAt), "MMM d, yyyy")}</span>
        </div>

        <div
          class="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={job.body}
        />

        {job.link && (
          <div class="mt-8 pt-6 border-t border-gray-100">
            <a
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Apply Now
            </a>
          </div>
        )}
      </div>
    </div>
  );
});
