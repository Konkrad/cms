import { defineModule, t } from "~/core";
import { jobApprovedNotification } from "./notifications";
import { jobsPages } from "./pages";
import { jobReview } from "./review";
import jobsSchema from "./schema";
import { jobsService } from "./service";

export const jobsModule = defineModule({
	id: "jobs",
	schema: jobsSchema,
	pages: jobsPages,
	// Jobs are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [
			{ path: "jobs", label: t("jobs.module.jobs"), order: 110, scopes: "all" },
		],
	},
	menuLinks: [{ key: "jobs", label: t("jobs.module.jobs"), url: "/jobs" }],
	notifications: [jobApprovedNotification],
	// Listings are approved in core's Reviews queue (review.ts).
	reviews: { job: jobReview },
	// `jobs:job:<id>` → `<scope path>/jobs/<id>`.
	refs: {
		job: {
			label: t("jobs.module.job"),
			path: "/jobs/:id",
			locate: (ids) => jobsService.locate(ids),
			search: (query, limit) => jobsService.searchPublished(query, limit),
		},
	},
	// Demo jobs and menu links; lazy (dev dependencies stay out of the server).
	seed: async (ctx) => (await import("./seed")).seedJobs(ctx),
});
