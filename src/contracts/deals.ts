/**
 * Core → theme data contract for the single-deal route (`/deals/[id]`), and
 * for the core-owned `useDealsList` block composable.
 */

import type { Deal } from "~/db/schemas/deals";
import type { useDeal } from "~/routes/deals/[id]";

export type DealViewData = NonNullable<ReturnType<typeof useDeal>["value"]>;

/** Deal list item as returned by `~/components/builder/blocks/useDealsList`. */
export type DealListItem = Deal;
