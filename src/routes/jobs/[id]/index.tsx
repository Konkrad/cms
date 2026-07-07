import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { jobsService } from "~/services/jobs.service";
import { useThemeNamedExports$ } from "~/utils/theme-loader";
import { ThemeNamedExport } from "~/utils/theme-components";

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

export default component$(() => {
  const data = useJob();

  const { JobDetailView } = useThemeNamedExports$(
    async () => import("~theme/routes/jobs/JobDetailView"),
  );

  return <ThemeNamedExport resource={JobDetailView} data={data.value} />;
});
