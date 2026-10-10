/**
 * Core → theme data contracts for the public jobs pages (modules/jobs).
 */
import type {
	useDeleteMyJob,
	useSubmitJob,
	useUpdateMyJob,
} from "~modules/jobs/actions";
import type {
	editMyJobPage,
	jobDetailPage,
	jobsListPage,
	myJobsPage,
} from "~modules/jobs/pages";

type PageData<P extends { load: (...args: never[]) => Promise<unknown> }> =
	Awaited<ReturnType<P["load"]>>;

export type JobsListData = PageData<typeof jobsListPage>;

/** Single job list item — replaces importing `JobWithUser` from the jobs module service in theme. */
export type JobListItem = JobsListData["items"][number];
export type JobDetailData = PageData<typeof jobDetailPage>;
export type MyJobsData = PageData<typeof myJobsPage>;
export type DeleteMyJobAction = ReturnType<typeof useDeleteMyJob>;

/** Loose action-store shape shared by the new/edit job forms (different zod$ shapes per action). */
export type JobFormAction = {
	value: { failed?: boolean; error?: string } | undefined;
	submit: (data: FormData) => Promise<unknown>;
};
export type SubmitJobAction = ReturnType<typeof useSubmitJob> & JobFormAction;
export type UpdateMyJobAction = ReturnType<typeof useUpdateMyJob> &
	JobFormAction;
export type EditMyJobData = PageData<typeof editMyJobPage>;
