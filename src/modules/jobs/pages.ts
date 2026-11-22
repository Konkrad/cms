import type { JobDetailData, JobsListData } from "~/contracts/jobs";
import {
	definePage,
	itemUrl,
	renderRichHtml,
	requestContentFilter,
	requireAuth,
	requireCanonicalUrl,
	reviews,
	withItemUrls,
} from "~/core";
import { toPublicJob } from "./public-job";
import { jobRef } from "./review";
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
		const jobs = await jobsService.getByUser(user.id);
		// The poster's own listings, with where their review stands and the reviewer's comment.
		const statuses = await reviews.statusOfMany(jobs.map((j) => jobRef(j.id)));
		return {
			jobs: jobs.map((j) => {
				const s = statuses.get(jobRef(j.id));
				return {
					...j,
					review: s ? { status: s.status, comment: s.comment } : null,
				};
			}),
		};
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
		const user = await requireAuth(event);
		const job = await jobsService.getById(params.id);
		const now = new Date().toISOString();
		const live = job?.status === "approved" && job.expiresAt >= now;
		// Reviewers may preview a pending listing from the Reviews queue.
		if (!job || (!live && !(await reviews.canReview(user, jobRef(job.id))))) {
			throw event.error(404, "Job not found");
		}
		requireCanonicalUrl(event, await itemUrl("jobs:job", job));
		return {
			job: { ...toPublicJob(job), body: await renderRichHtml(job.body) },
		};
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
