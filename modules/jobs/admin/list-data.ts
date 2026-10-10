import type { RequestEventLoader } from "@qwik.dev/router";
import { PAGE_SIZE } from "~/ui";
import { type JobWithUser, jobsService } from "../service";
import { requireJobsAdmin } from "./auth";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminJobs(event: RequestEventLoader) {
	await requireJobsAdmin(event);

	const search = event.url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(event.url.searchParams.get("page") ?? "1") || 1,
	);

	const all = (await jobsService.getAll()) as JobWithUser[];
	const filtered = search
		? all.filter(
				(j) =>
					j.title.toLowerCase().includes(search.toLowerCase()) ||
					(j.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
					(j.country ?? "").toLowerCase().includes(search.toLowerCase()),
			)
		: all;

	const total = filtered.length;
	const jobs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return { jobs, total, page, pageSize: PAGE_SIZE, search };
}

export type AdminJobsData = Awaited<ReturnType<typeof loadAdminJobs>>;
