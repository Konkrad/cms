import { defineModule } from "~/core";
import { jobApprovedNotification } from "./notifications";
import { jobsPages } from "./pages";

export const jobsModule = defineModule({
	id: "jobs",
	pages: jobsPages,
	// Jobs are owned by a scope; each scope's admin manages its own and its subtree's.
	admin: {
		sections: [{ path: "jobs", label: "Jobs", order: 110, scopes: "all" }],
	},
	menuLinks: [{ key: "jobs", label: "Jobs", url: "/jobs" }],
	notifications: [jobApprovedNotification],
});
