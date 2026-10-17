import { defineModule, t } from "~/core";
import { jobApprovedNotification } from "./notifications";
import { jobsPages } from "./pages";
import { jobsService } from "./service";

export const jobsModule = defineModule({
	id: "jobs",
	pages: jobsPages,
	// Jobs are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [
			{ path: "jobs", label: t("jobs.module.jobs"), order: 110, scopes: "all" },
		],
	},
	menuLinks: [{ key: "jobs", label: t("jobs.module.jobs"), url: "/jobs" }],
	notifications: [jobApprovedNotification],
	// `jobs:job:<id>` → `<scope path>/jobs/<id>`.
	refs: {
		job: {
			label: t("jobs.module.job"),
			path: "/jobs/:id",
			locate: (ids) => jobsService.locate(ids),
			search: (query, limit) => jobsService.searchPublished(query, limit),
		},
	},
});
