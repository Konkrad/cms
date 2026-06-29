/**
 * Core → theme data contract for the single-deal route (`/deals/[id]`).
 */
import type { useDeal } from "~/routes/deals/[id]";

export type DealViewData = NonNullable<ReturnType<typeof useDeal>["value"]>;
