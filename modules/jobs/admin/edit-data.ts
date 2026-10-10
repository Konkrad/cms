import type { RequestEventLoader } from "@qwik.dev/router";
import { jobsService } from "../service";
import { requireJobsAdmin } from "./auth";

/** Server-only: import from route loaders only, never from components. */
/** Returns the job, or null when it does not exist (the route then redirects). */
export async function loadAdminJob(event: RequestEventLoader) {
	await requireJobsAdmin(event);
	return (await jobsService.getById(event.params.id)) ?? null;
}
