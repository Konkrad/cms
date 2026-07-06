import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { electionsService } from "~/services/elections.service";
import { useThemeComponent$ } from "~/utils/theme-loader";
import type { FC } from "react";

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
  const ElectionsView = useThemeComponent$<FC<{ data: any }>>(
    () => import("~theme/routes/elections/ElectionsView"),
  );
  return ElectionsView.value && <ElectionsView.value data={data.value} />;
});
