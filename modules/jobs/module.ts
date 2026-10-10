import { defineModule } from "~/core-api";
import { jobsPages } from "./pages";

export const jobsModule = defineModule({
	id: "jobs",
	pages: jobsPages,
	admin: { sections: [{ path: "jobs", label: "Jobs" }] },
	menuLinks: [{ key: "jobs", label: "Jobs", url: "/jobs" }],
});
