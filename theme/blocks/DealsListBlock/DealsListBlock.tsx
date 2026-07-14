import { component$, useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { Deal } from "~/db/schemas/deals";
import { dealsService } from "~/services/deals.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
  name: "Deals",
  componentType: "DealsListBlock",
  category: "dynamic",
  icon: "🎁",
  configSchema: [],
  defaultData: {},
};

const fetchActiveDeals = server$(async (): Promise<Deal[]> => {
  return dealsService.getActive();
});

export default component$(() => {
  const deals = useSignal<Deal[]>([]);
  const isLoading = useSignal(true);
  const errorMsg = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      deals.value = await fetchActiveDeals();
    } catch (e) {
      errorMsg.value = e instanceof Error ? e.message : "Failed to load deals";
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-text-muted">Loading deals...</p>
        </div>
      ) : errorMsg.value ? (
        <p class="text-error text-center py-8">
          Failed to load deals: {errorMsg.value}
        </p>
      ) : deals.value.length === 0 ? (
        <p class="text-text-muted text-center py-8">No deals available.</p>
      ) : (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.value.map((deal) => (
            <ContentCard
              key={deal.id}
              title={deal.name}
              image={publicImageUrlFromKey(deal.logo)}
              imageAlt={deal.name}
              description={deal.description ?? undefined}
              href={`/deals/${deal.id}`}
              label="View deal"
            />
          ))}
        </div>
      )}
    </div>
  );
});
