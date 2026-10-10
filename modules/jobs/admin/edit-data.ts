import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAdmin } from "~/core-api";
import { toPublicJob } from "../public-job";
import { jobsService } from "../service";

/** Server-only: import from route loaders only, never from components. */
/** Returns the job, or null when it does not exist (the route then redirects). */
export async function loadAdminJob(event: RequestEventLoader) {
	await requireModuleAdmin(event, { module: "jobs", scope: "global" });
	const job = await jobsService.getById(event.params.id);
	return job ? toPublicJob(job) : null;
}
