import { createElement } from "react";
import {
	defineNotification,
	itemRef,
	notify,
	refHref,
	resolveRef,
	t,
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
	label: t("jobs.notifications.approved.label"),
	description: t("jobs.notifications.approved.description"),
	channels: ["email"],
	optional: true,
	render: {
		email: async (data, ctx) => ({
			subject: t("jobs.notifications.approved.subject", {
				jobTitle: data.jobTitle,
			}),
			react: createElement(JobApprovedEmail, {
				baseUrl: ctx.appUrl,
				recipientName:
					ctx.recipient.name ?? t("jobs.notifications.fallbackName"),
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

/** Tells the poster that their job listing was approved (optional email). Server-only. */
export async function notifyJobApproved(job: {
	id: string;
	title: string;
	suggestedBy: string;
}): Promise<void> {
	await notify(jobApprovedNotification.id, {
		to: job.suggestedBy,
		data: {
			jobId: job.id,
			jobTitle: job.title,
			link: refHref(itemRef("jobs", "job", job.id)),
		},
	});
}
