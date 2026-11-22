import { type ReviewHandlers, reviews } from "~/core";
import { notifyJobApproved } from "./notifications";
import { jobsService } from "./service";

/**
 * Job listings go through core's review flow (manifest `reviews.job`): a member's listing stays
 * pending until an admin, moderator or representative of its scope (or above) approves it in the
 * Reviews queue; one posted by such a manager is approved at once. Core calls the handlers after
 * a decision and retries them until they succeed, so both are safe to call again. Server-only.
 */
export const jobReview: ReviewHandlers = {
	required: "unless-manager",
	deciders: "scope-managers",
	// The poster hears about an approval through the optional "job approved" email.
	announcesApproval: true,
	async onApproved(_ctx, { id }) {
		const job = await jobsService.getById(id);
		if (!job || job.status === "approved") return;
		const approved = await jobsService.update(id, { status: "approved" });
		await notifyJobApproved(approved);
	},
	// Rejected: the listing stays pending; the poster sees the comment, edits and resubmits.
	async onRejected() {},
};

export const jobRef = (id: string) => `jobs:job:${id}`;

/**
 * Submits a pending listing for review; approves it at once when no review is needed (the
 * poster manages its scope). Server-only.
 */
export async function submitJobForReview(
	userId: string,
	jobId: string,
): Promise<{ inReview: boolean }> {
	const { required } = await reviews.submit({ userId }, jobRef(jobId));
	if (!required) await jobsService.update(jobId, { status: "approved" });
	return { inReview: required };
}
