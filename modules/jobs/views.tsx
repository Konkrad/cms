import { component$ } from "@qwik.dev/core";
import type {
	EditMyJobData,
	JobDetailData,
	MyJobsData,
} from "~/contracts/jobs";
import type { PageViews } from "~/core";
import { JobDetailView } from "~theme/routes/jobs/JobDetailView";
import {
	type JobFormInitialValues,
	JobFormView,
} from "~theme/routes/jobs/JobFormView";
import { JobsListView } from "~theme/routes/jobs/JobsListView";
import { MyJobsView } from "~theme/routes/jobs/MyJobsView";
import { useDeleteMyJob, useSubmitJob, useUpdateMyJob } from "./actions";

const MAX_DAYS = 30;

function maxDateStr() {
	const maxDate = new Date();
	maxDate.setDate(maxDate.getDate() + MAX_DAYS);
	return maxDate.toISOString().slice(0, 10);
}

const MyJobsPage = component$<{ data: MyJobsData }>(({ data }) => {
	const deleteAction = useDeleteMyJob();
	return <MyJobsView data={data} deleteAction={deleteAction} />;
});

const NewJobPage = component$(() => {
	const submitAction = useSubmitJob();
	const max = maxDateStr();
	const initial: JobFormInitialValues = {
		title: "",
		editorState: null,
		body: "",
		locationType: "on-site",
		city: "",
		country: "",
		link: "",
		posterRelation: "",
		expiresAt: max,
	};
	return (
		<JobFormView
			mode="new"
			backHref="/jobs"
			backLabel="Back to Job Board"
			heading="Post a Job"
			initial={initial}
			maxDateStr={max}
			cancelHref="/jobs"
			submitLabel="Submit for Review"
			submittingLabel="Submitting…"
			action={submitAction}
		/>
	);
});

const EditMyJobPage = component$<{ data: EditMyJobData }>(({ data }) => {
	const updateAction = useUpdateMyJob();
	const job = data.job;
	const initial: JobFormInitialValues = {
		title: job.title,
		editorState: job.editorState ?? null,
		body: job.body ?? "",
		locationType: job.locationType,
		city: job.city ?? "",
		country: job.country ?? "",
		link: job.link ?? "",
		posterRelation: job.posterRelation ?? "",
		expiresAt: job.expiresAt.slice(0, 10),
	};
	return (
		<JobFormView
			mode="edit"
			backHref="/jobs/mine"
			backLabel="Back to My Submissions"
			heading="Edit Job Posting"
			initial={initial}
			maxDateStr={maxDateStr()}
			cancelHref="/jobs/mine"
			submitLabel="Save Changes"
			submittingLabel="Saving…"
			action={updateAction}
		/>
	);
});

export const jobsViews: PageViews = {
	"jobs.list": { view: JobsListView },
	"jobs.new": { view: NewJobPage },
	"jobs.mine": { view: MyJobsPage },
	"jobs.mine.edit": { view: EditMyJobPage },
	"jobs.detail": {
		view: JobDetailView,
		head: (data) => ({ title: (data as JobDetailData).job.title }),
	},
};
