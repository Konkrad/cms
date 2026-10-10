import { defineModule } from "~/core";
import { jobsPages } from "./pages";

export const jobsModule = defineModule({
	id: "jobs",
	pages: jobsPages,
	admin: { sections: [{ path: "jobs", label: "Jobs", order: 110 }] },
	menuLinks: [{ key: "jobs", label: "Jobs", url: "/jobs" }],
});
