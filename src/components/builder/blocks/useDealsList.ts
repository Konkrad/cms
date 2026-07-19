import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { DealListItem } from "~/contracts/deals";
import { dealsService } from "~/services/deals.service";

const fetchActiveDeals = server$(async (): Promise<DealListItem[]> => {
	return dealsService.getActive();
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
