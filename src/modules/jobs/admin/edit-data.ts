import type { RequestEventLoader } from "@qwik.dev/router";
import { requireModuleAdmin, requireWithinScope } from "~/core";
import { toPublicJob } from "../public-job";
import { jobsService } from "../service";

/**
 * Server-only: import from route loaders only, never from components. The job must lie in the
 * URL scope's subtree (404 otherwise).
 */
export async function loadAdminJob(event: RequestEventLoader) {
	const { scope, adminBase } = await requireModuleAdmin(event, {
		module: "jobs",
		scope: "any",
	});
	const job = await jobsService.getById(event.params.id);
	await requireWithinScope(event, scope, job);
	return { job: toPublicJob(job!), adminBase };
}

export type AdminJobData = Awaited<ReturnType<typeof loadAdminJob>>;
