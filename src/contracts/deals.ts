/**
 * Core → theme data contract for the public deal page (`/deals/:id`, src/modules/deals),
 * and for the module-owned `useDealsList` block composable.
 */

import type { dealDetailPage } from "~/modules/deals/pages";
import type { toDealListItem } from "~/modules/deals/public-deal";

export type DealDetailData = Awaited<ReturnType<typeof dealDetailPage.load>>;

/** Props of the themed deal view. */
export type DealViewData = Pick<DealDetailData, "deal" | "isLoggedIn">;

/** Deal list item as returned by `~/modules/deals/useDealsList`. */
export type DealListItem = ReturnType<typeof toDealListItem> & {
	/** Canonical URL under the owning scope. */
	url: string;
};
