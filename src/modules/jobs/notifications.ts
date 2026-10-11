import { createElement } from "react";
import {
	defineNotification,
	itemRef,
	notify,
	refHref,
	resolveRef,
} from "~/core";
import JobApprovedEmail from "~theme/emails/JobApproved";

/**
 * Sent to the member who suggested a job once an admin approves it. Optional: members can
 * mute it in their profile or via the email's one-click unsubscribe link.
 */
export const jobApprovedNotification = defineNotification<{
	jobId: string;
	jobTitle: string;
	/** The job's page as a reference (`ref:jobs:job:<id>`), resolved at send time. */
	link: string;
}>({
	id: "jobs.approved",
	label: "Job approved",
	description: "When a job you suggested is approved and published.",
	channels: ["email"],
	optional: true,
	render: {
		email: async (data, ctx) => ({
			subject: `Your job "${data.jobTitle}" is live`,
			react: createElement(JobApprovedEmail, {
				baseUrl: ctx.appUrl,
				recipientName: ctx.recipient.name ?? "there",
				jobTitle: data.jobTitle,
				// The current URL (the scope may have moved since); the job board if it is gone.
				jobUrl: new URL(
					(data.link && (await resolveRef(data.link))) || "/jobs",
					ctx.appUrl,
				).toString(),
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
		data: {
			jobId: after.id,
			jobTitle: after.title,
			link: refHref(itemRef("jobs", "job", after.id)),
		},
	});
}
