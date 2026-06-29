import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";
import { ElectionsView } from "~theme/routes/elections/ElectionsView";

export const useElections = routeLoader$(async (event) => {
  const { requireAuth } = await import("~/utils/server-auth");
  await requireAuth(event);
  const all = await electionsService.getPublicCycles();
  const open = all.filter((c) => c.status === "open" || c.status === "voting");
  if (open.length > 0) throw event.redirect(302, `/elections/${open[0].id}`);
  return { cycles: open };
});

export default component$(() => {
  const data = useElections();
  return <ElectionsView data={data.value} />;
});
