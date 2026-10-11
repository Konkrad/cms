import type { JobDetailData, JobsListData } from "~/contracts/jobs";
import {
	definePage,
	itemUrl,
	requestContentFilter,
	requireAuth,
	requireCanonicalUrl,
	withItemUrls,
} from "~/core";
import { toPublicJob } from "./public-job";
import { jobsService } from "./service";

export const JOBS_PAGE_SIZE = 10;

export const jobsListPage = definePage({
	id: "jobs.list",
	path: "/jobs",
	async load(event): Promise<JobsListData> {
		await requireAuth(event);
		const page = await jobsService.getApprovedPaged(
			await requestContentFilter(event),
			JOBS_PAGE_SIZE,
		);
		return {
			...page,
			items: await withItemUrls("jobs:job", page.items.map(toPublicJob)),
		};
	},
});

export const jobsNewPage = definePage({
	id: "jobs.new",
	path: "/jobs/new",
	async load(event) {
		await requireAuth(event);
		return null;
	},
});

export const myJobsPage = definePage({
	id: "jobs.mine",
	path: "/jobs/mine",
	async load(event) {
		const user = await requireAuth(event);
		return { jobs: await jobsService.getByUser(user.id) };
	},
});

export const editMyJobPage = definePage({
	id: "jobs.mine.edit",
	path: "/jobs/mine/:id/edit",
	async load(event, { params }) {
		const user = await requireAuth(event);
		const job = await jobsService.getById(params.id);
		if (!job || job.suggestedBy !== user.id || job.status !== "pending") {
			throw event.redirect(302, "/jobs/mine");
		}
		const { user: _author, ...ownJob } = job;
		return { job: ownJob };
	},
});

export const jobDetailPage = definePage({
	id: "jobs.detail",
	path: "/jobs/:id",
	async load(event, { params }): Promise<JobDetailData> {
		await requireAuth(event);
		const job = await jobsService.getById(params.id);
		const now = new Date().toISOString();
		if (!job || job.status !== "approved" || job.expiresAt < now) {
			throw event.error(404, "Job not found");
		}
		requireCanonicalUrl(event, await itemUrl("jobs:job", job));
		return { job: toPublicJob(job) };
	},
});

// Declared order matters: static paths before "/jobs/:id".
export const jobsPages = [
	jobsListPage,
	jobsNewPage,
	myJobsPage,
	editMyJobPage,
	jobDetailPage,
];
