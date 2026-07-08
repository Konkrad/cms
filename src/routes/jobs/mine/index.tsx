import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { jobsService } from "~/services/jobs.service";
import { useThemeNamedExports$ } from "~/utils/theme-loader";
import { ThemeNamedExport } from "~/utils/theme-components";

export const useMyJobs = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);
  const jobs = await jobsService.getByUser(user.id);
  return { jobs };
});

export const useDeleteMyJob = routeAction$(
  async (data, event) => {
    const { requireAuth } = await import("~/utils/server-auth");
    const user = await requireAuth(event);

    const job = await jobsService.getById(data.jobId);
    if (!job || job.suggestedBy !== user.id) {
      return { failed: true };
    }

    await jobsService.delete(data.jobId);
    return { success: true };
  },
  zod$({ jobId: z.string().uuid() }),
);

export default component$(() => {
  const data = useMyJobs();
  const deleteAction = useDeleteMyJob();

  const { MyJobsView } = useThemeNamedExports$(
    async () => import("~theme/routes/jobs/MyJobsView"),
  );

  return (
    <ThemeNamedExport
      resource={MyJobsView}
      data={data.value}
      deleteAction={deleteAction}
    />
  );
});
