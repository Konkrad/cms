/**
 * Core → theme data contracts for the public jobs routes.
 */
import type { useJobs } from "~/routes/jobs";
import type { useJob } from "~/routes/jobs/[id]";
import type { useMyJobs, useDeleteMyJob } from "~/routes/jobs/mine";
import type { useSubmitJob } from "~/routes/jobs/new";
import type { useJob as useEditMyJob, useUpdateMyJob } from "~/routes/jobs/mine/[id]/edit";

export type JobsListData = ReturnType<typeof useJobs>["value"];
export type JobDetailData = ReturnType<typeof useJob>["value"];
export type MyJobsData = ReturnType<typeof useMyJobs>["value"];
export type DeleteMyJobAction = ReturnType<typeof useDeleteMyJob>;

/** Loose action-store shape shared by the new/edit job forms (different zod$ shapes per action). */
export type JobFormAction = {
  value: { failed?: boolean; error?: string } | undefined;
  submit: (data: FormData) => Promise<unknown>;
};
export type SubmitJobAction = ReturnType<typeof useSubmitJob> & JobFormAction;
export type UpdateMyJobAction = ReturnType<typeof useUpdateMyJob> & JobFormAction;
export type EditMyJobData = ReturnType<typeof useEditMyJob>["value"];
