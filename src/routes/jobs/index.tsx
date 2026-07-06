import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { jobsService } from "~/services/jobs.service";
import { useThemeNamedExports$ } from "~/utils/theme-loader";

const PAGE_SIZE = 10;

export const useJobs = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(event);
  return jobsService.getApprovedPaged(PAGE_SIZE);
});

export default component$(() => {
  const data = useJobs();

  const { JobsListView } = useThemeNamedExports$(
    async () => import("~theme/routes/jobs/JobsListView"),
  );

  return JobsListView.value && <JobsListView.value data={data.value} />;
});
