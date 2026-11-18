/**
 * Core → theme data contracts for the public jobs pages (src/modules/jobs).
 */

import type { PublicUser } from "~/core/users/public-user";
import type {
	useDeleteMyJob,
	useSubmitJob,
	useUpdateMyJob,
} from "~/modules/jobs/actions";
import type { editMyJobPage, myJobsPage } from "~/modules/jobs/pages";
import type { Job } from "~/modules/jobs/schema";

type PageData<P extends { load: (...args: never[]) => Promise<unknown> }> =
	Awaited<ReturnType<P["load"]>>;

/** The member who posted a job: public identity only. */
export type JobAuthor = PublicUser;

/** A job as shown to other members (list, detail, admin): the author is public only. */
export type PublicJob = Job & { user: JobAuthor | null };

/** Payload of `/jobs` (declared, not derived: it shows other members' jobs). */
export type JobsListData = {
	items: JobListItem[];
	nextCursor: string | null;
	prevCursor: string | null;
};

/** Single job list item, with its canonical URL. */
export type JobListItem = PublicJob & { url: string };

/** Payload of `/jobs/:id`. */
export type JobDetailData = { job: PublicJob };
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
