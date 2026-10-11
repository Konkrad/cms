import { createElement } from "react";
import { defineNotification, notify } from "~/core";
import JobApprovedEmail from "~theme/emails/JobApproved";

/**
 * Sent to the member who suggested a job once an admin approves it. Optional: members can
 * mute it in their profile or via the email's one-click unsubscribe link.
 */
export const jobApprovedNotification = defineNotification<{
	jobId: string;
	jobTitle: string;
}>({
	id: "jobs.approved",
	label: "Job approved",
	description: "When a job you suggested is approved and published.",
	channels: ["email"],
	optional: true,
	render: {
		email: (data, ctx) => ({
			subject: `Your job "${data.jobTitle}" is live`,
			react: createElement(JobApprovedEmail, {
				baseUrl: ctx.appUrl,
				recipientName: ctx.recipient.name ?? "there",
				jobTitle: data.jobTitle,
				jobUrl: `${ctx.appUrl}/jobs/${data.jobId}`,
				unsubscribeUrl: ctx.unsubscribeUrl,
			}),
		}),
	},
});

/** Notifies the poster when a job goes from pending to approved. Server-only. */
export async function notifyIfApproved(
	before: { status: string } | undefined,
	after: { id: string; title: string; status: string; suggestedBy: string },
): Promise<void> {
	if (before?.status !== "pending" || after.status !== "approved") return;
	await notify(jobApprovedNotification.id, {
		to: after.suggestedBy,
		data: { jobId: after.id, jobTitle: after.title },
	});
}
