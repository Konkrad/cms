import { component$ } from "@qwik.dev/core";
import { Form, Link, routeAction$, routeLoader$, zod$, z } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { jobsService, type JobWithUser } from "~/services/jobs.service";

export const useGlobalOnly = routeLoader$(async ({ params, redirect }) => {
  if (params.group_slug !== "global") {
    throw redirect(302, "/admin/global/jobs");
  }
  return {};
});

export const useJobs = routeLoader$(async (event) => {
  if (event.params.group_slug !== "global") {
    throw event.redirect(302, "/admin/global/jobs");
  }
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);
  const jobs = await jobsService.getAll();
  return { jobs };
});

export const useApproveJob = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await jobsService.update(data.jobId, { status: "approved" } as any);
    return { success: true };
  },
  zod$({ jobId: z.string().uuid() }),
);

export const useDeleteJob = routeAction$(
  async (data, event) => {
    const { requireAdmin } = await import("~/utils/server-auth");
    await requireAdmin(event);
    await jobsService.delete(data.jobId);
    return { success: true };
  },
  zod$({ jobId: z.string().uuid() }),
);

export default component$(() => {
  useGlobalOnly();
  const data = useJobs();
  const approveAction = useApproveJob();
  const deleteAction = useDeleteJob();
  const now = new Date();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Jobs</h2>
      </div>

      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Suggested By
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
            {(data.value.jobs as JobWithUser[]).map((job) => {
              const isExpired = new Date(job.expiresAt) < now;
              const locationLabel =
                job.locationType === "on-site"
                  ? [job.city, job.country].filter(Boolean).join(", ") || "On-site / Hybrid"
                  : job.locationType === "remote-eu"
                    ? "Remote — EU"
                    : `Remote — ${job.country ?? ""}`;

              return (
                <tr key={job.id} class="hover:bg-gray-50">
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">
                      {job.title}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {job.user?.name} {job.user?.familyName}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {locationLabel}
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
                      {job.status === "approved" ? "Approved" : "Pending"}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex items-center gap-4">
                      {job.status === "pending" && (
                        <Form action={approveAction}>
                          <input type="hidden" name="jobId" value={job.id} />
                          <button
                            type="submit"
                            class="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                        </Form>
                      )}
                      <Link
                        href={`/admin/global/jobs/${job.id}/edit`}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </Link>
                      <Form action={deleteAction}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <button
                          type="submit"
                          preventdefault:click
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (!confirm("Delete this job posting?")) return;
                            (e.target as HTMLElement).closest("form")?.requestSubmit();
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
        {data.value.jobs.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No job postings yet.
          </div>
        )}
      </div>
    </div>
  );
});
