import type { RequestEventLoader } from "@qwik.dev/router";
import { getSubtreeIds, requireModuleAdmin, reviews } from "~/core";
import { PAGE_SIZE } from "~/core/ui";
import { toPublicJob } from "../public-job";
import { jobRef } from "../review";
import { jobsService } from "../service";

/** Server-only: import from route loaders only, never from components. */
export async function loadAdminJobs(event: RequestEventLoader) {
	const { scope, isRoot, adminBase } = await requireModuleAdmin(event, {
		module: "jobs",
	});

	const search = event.url.searchParams.get("search")?.trim() ?? "";
	const page = Math.max(
		1,
		parseInt(event.url.searchParams.get("page") ?? "1") || 1,
	);

	// The root lists every job; other scopes their own and their subtree's.
	const all = (
		await jobsService.getAll(isRoot ? null : await getSubtreeIds(scope.id))
	).map(toPublicJob);
	const filtered = search
		? all.filter(
				(j) =>
					j.title.toLowerCase().includes(search.toLowerCase()) ||
					(j.city ?? "").toLowerCase().includes(search.toLowerCase()) ||
					(j.country ?? "").toLowerCase().includes(search.toLowerCase()),
			)
		: all;

	const total = filtered.length;
	const pageJobs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	// Pending listings show where their review stands (in review / rejected).
	const statuses = await reviews.statusOfMany(
		pageJobs.map((j) => jobRef(j.id)),
	);
	const jobs = pageJobs.map((j) => ({
		...j,
		reviewStatus: statuses.get(jobRef(j.id))?.status ?? null,
	}));

	return { jobs, total, page, pageSize: PAGE_SIZE, search, adminBase };
}

export type AdminJobsData = Awaited<ReturnType<typeof loadAdminJobs>>;
