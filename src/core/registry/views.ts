import type { PageViews } from "~/core/page-views";
import { dealsViews } from "../../../modules/deals/views";
import { jobsViews } from "../../../modules/jobs/views";

/** Page id → view for the catch-all route (client-safe: no server imports). */
export const moduleViews: PageViews = { ...dealsViews, ...jobsViews };
