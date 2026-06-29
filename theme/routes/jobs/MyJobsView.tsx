import { component$ } from "@qwik.dev/core";
import { Form, Link } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import type { DeleteMyJobAction, MyJobsData } from "~/contracts/jobs";

function locationLabel(job: { locationType: string; city?: string | null; country?: string | null }) {
  if (job.locationType === "on-site") {
    return [job.city, job.country].filter(Boolean).join(", ") || "On-site";
  }
  if (job.locationType === "remote-eu") return "Remote — EU";
  return `Remote — ${job.country ?? ""}`;
}

/** Themed view for the user's own job submissions (`/jobs/mine`). */
export const MyJobsView = component$<{ data: MyJobsData; deleteAction: DeleteMyJobAction }>(
  ({ data, deleteAction }) => {
    return (
      <div class="max-w-3xl mx-auto px-4 py-8">
        <div class="mb-6">
          <Link href="/jobs" class="text-sm text-blue-600 hover:text-blue-800">
            ← Back to Job Board
          </Link>
        </div>

        <div class="flex items-center justify-between mb-8">
          <h1 class="text-2xl font-bold text-gray-900">My Job Submissions</h1>
          <Button href="/jobs/new">Post a Job</Button>
        </div>

        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {data.jobs.length === 0 ? (
            <div class="text-center py-12 text-gray-500">
              You haven't submitted any job postings yet.
            </div>
          ) : (
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                {data.jobs.map((job) => {
                  const isExpired = new Date(job.expiresAt) < new Date();
                  return (
                    <tr key={job.id} class="hover:bg-gray-50">
                      <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">{job.title}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {locationLabel(job)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class={isExpired ? "text-red-600 font-medium" : "text-gray-700"}>
                          {isExpired ? "Expired · " : ""}
                          {format(new Date(job.expiresAt), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={[
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            job.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800",
                          ].join(" ")}
                        >
                          {job.status === "approved" ? "Approved" : "Pending review"}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex items-center gap-4">
                          {job.status === "pending" && (
                            <Link
                              href={`/jobs/mine/${job.id}/edit`}
                              class="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </Link>
                          )}
                          <Form action={deleteAction}>
                            <input type="hidden" name="jobId" value={job.id} />
                            <button
                              type="submit"
                              class="text-red-600 hover:text-red-900"
                              onClick$={(e) => {
                                if (!confirm("Delete this job posting?")) {
                                  e.preventDefault();
                                }
                              }}
                            >
                              Delete
                            </button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  },
);
