import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { DealListItem } from "~/contracts/deals";
import { requestContentFilter } from "~/core";
import { toDealListItem } from "./public-deal";
import { dealsService } from "./service";

// The listing of the page's scope (the URL's scope prefix).
const fetchActiveDeals = server$(async function (): Promise<DealListItem[]> {
	return (await dealsService.getActive(await requestContentFilter(this))).map(
		toDealListItem,
	);
});

/** Headless composable owning data-fetching for the "Deals" page-builder block. */
export function useDealsList() {
	const deals = useSignal<DealListItem[]>([]);
	const isLoading = useSignal(true);
	const error = useSignal<string | null>(null);

	useTask$(async () => {
		try {
			deals.value = await fetchActiveDeals();
		} catch (e) {
			error.value = e instanceof Error ? e.message : "Failed to load deals";
		} finally {
			isLoading.value = false;
		}
	});

	return { deals, isLoading, error };
}
