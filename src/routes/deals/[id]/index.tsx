import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { dealsService } from "~/services/deals.service";
import { getServerSession } from "~/utils/server-auth";
import { useThemeComponent$ } from "~/utils/theme-loader";
import type { FC } from "react";

export const useDeal = routeLoader$(async (event) => {
  const deal = await dealsService.getById(event.params.id);

  if (!deal) {
    throw event.error(404, "Deal not found");
  }

  const now = new Date().toISOString();
  if (deal.validUntil && deal.validUntil < now) {
    throw event.error(404, "This deal is no longer available");
  }

  const user = await getServerSession(event);
  const isLoggedIn = !!user;

  return {
    deal,
    isLoggedIn,
  };
});

export default component$(() => {
  const deal = useDeal();
  const DealView = useThemeComponent$<FC<{ deal: any; isLoggedIn: boolean }>>(
    () => import("~theme/routes/deals/DealView"),
  );
  return (
    DealView.value && (
      <DealView.value
        deal={deal.value.deal}
        isLoggedIn={deal.value.isLoggedIn}
      />
    )
  );
});
