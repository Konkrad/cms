import { definePage } from "~/core/pages";
import { jobsService } from "~/services/jobs.service";
import { requireAuth } from "~/utils/server-auth";
import { toPublicJob } from "./public-job";

export const JOBS_PAGE_SIZE = 10;

export const jobsListPage = definePage({
	id: "jobs.list",
	path: "/jobs",
	async load(event) {
		await requireAuth(event);
		const page = await jobsService.getApprovedPaged(JOBS_PAGE_SIZE);
		return { ...page, items: page.items.map(toPublicJob) };
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
	async load(event, { params }) {
		await requireAuth(event);
		const job = await jobsService.getById(params.id);
		const now = new Date().toISOString();
		if (!job || job.status !== "approved" || job.expiresAt < now) {
			throw event.error(404, "Job not found");
		}
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
