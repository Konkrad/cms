/**
 * Core → theme data contract for the catch-all CMS page route (`/[...slug]`).
 */
import type { usePage } from "~/routes/[...slug]";

export type PageViewData = ReturnType<typeof usePage>["value"];
