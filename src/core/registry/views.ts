import type { PageViews } from "~/core/router/page-views";
import { dealsViews } from "../../modules/deals/views";
import { electionsViews } from "../../modules/elections/views";
import { eventsViews } from "../../modules/events/views";
import { jobsViews } from "../../modules/jobs/views";
import { qualificationsViews } from "../../modules/qualifications/views";

/** Page id → view for the catch-all route (client-safe: no server imports). */
export const moduleViews: PageViews = {
	...dealsViews,
	...electionsViews,
	...eventsViews,
	...jobsViews,
	...qualificationsViews,
};
