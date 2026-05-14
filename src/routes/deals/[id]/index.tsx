import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { dealsService } from "~/services/deals.service";
import { getServerSession } from "~/utils/server-auth";
import { DealBox } from "~/components/ui/DealBox";
import type { DealStep } from "~/db/schemas/deals";

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

function stepToBoxProps(step: DealStep, isLoggedIn: boolean) {
  const isLocked = (step.requiresLogin ?? false) && !isLoggedIn;
  const base = { type: step.type, title: step.title, isLocked } as const;

  if (step.type === "link") {
    return { ...base, description: step.text, content: step.link, linkText: step.linkText };
  }
  if (step.type === "promo") {
    return { ...base, description: step.text, content: step.promoCode };
  }
  return { ...base, description: step.text };
}

export default component$(() => {
  const { deal, isLoggedIn } = useDeal().value;

  return (
    <div class="max-w-4xl mx-auto px-4 py-12 text-center">
      <h1 class="font-['Lato',sans-serif] font-bold text-3xl text-[#121212] mb-2">
        {deal.name}
      </h1>
      {deal.description && (
        <p class="text-gray-600 text-base mb-2">{deal.description}</p>
      )}
      {deal.validUntil && (
        <p class="text-gray-400 text-sm mb-8">
          Valid until{" "}
          {new Date(deal.validUntil).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}

      {(deal.steps ?? []).length > 0 && (
        <div>
          <h2 class="font-['Lato',sans-serif] font-bold text-lg text-gray-700 mb-4">
            How to get this deal
          </h2>
          <div class="flex flex-wrap justify-center gap-4">
            {(deal.steps ?? []).map((step, i) => {
              const props = stepToBoxProps(step, isLoggedIn);
              return <DealBox key={i} {...props} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
});
