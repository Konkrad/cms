import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { publicImageUrlFromKey } from "~/core/media/images";
import { useDealsList } from "~/modules/deals/useDealsList";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
	name: t("theme.blocks.dealsList.deals"),
	componentType: "DealsListBlock",
	category: "dynamic",
	icon: "🎁",
	configSchema: [],
	defaultData: {},
};

export default component$(() => {
	const { deals, isLoading, error: errorMsg } = useDealsList();

	return (
		<div class="max-w-6xl mx-auto px-4 py-12">
			{isLoading.value ? (
				<div class="text-center py-12">
					<p class="text-text-muted">
						{t("theme.dealsListBlock.loadingDeals")}
					</p>
				</div>
			) : errorMsg.value ? (
				<p class="text-error text-center py-8">
					{t("theme.dealsListBlock.failedToLoadDeals", {
						value: errorMsg.value,
					})}
				</p>
			) : deals.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">
					{t("theme.dealsListBlock.noDealsAvailable")}
				</p>
			) : (
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{deals.value.map((deal) => (
						<ContentCard
							key={deal.id}
							title={deal.name}
							image={publicImageUrlFromKey(deal.logo)}
							imageAlt={deal.name}
							description={deal.description ?? undefined}
							href={deal.url}
							label={t("theme.dealsListBlock.viewDeal")}
						/>
					))}
				</div>
			)}
		</div>
	);
});
