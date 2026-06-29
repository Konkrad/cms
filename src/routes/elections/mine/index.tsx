import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";
import { MyApplicationsView } from "~theme/routes/elections/MyApplicationsView";

export const useMyApplications = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  const user = await requireAuth(event);
  const applications = await electionsService.getApplicationsByUser(user.id);

  const byCycle = new Map<string, { cycle: (typeof applications)[0]["cycle"]; apps: typeof applications }>();
  for (const app of applications) {
    const key = app.cycleId;
    if (!byCycle.has(key)) byCycle.set(key, { cycle: app.cycle, apps: [] });
    byCycle.get(key)!.apps.push(app);
  }

  return { groups: [...byCycle.values()].sort((a, b) => b.cycle.year - a.cycle.year) };
});

export default component$(() => {
  const data = useMyApplications();
  return <MyApplicationsView data={data.value} />;
});
