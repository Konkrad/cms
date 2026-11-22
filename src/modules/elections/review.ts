import { type ReviewHandlers, reviews, t } from "~/core";
import { electionsService } from "./service";

/**
 * Election applications go through core's review flow (manifest `reviews.application`): every
 * application waits until an admin, moderator or representative of the election's scope (or
 * above) approves or rejects it in the Reviews queue. The decision and its comment are copied
 * to the application, which the applicant sees under "My applications". Core calls the handlers
 * after a decision and retries them until they succeed, so both are safe to call again.
 * Server-only.
 */
export const applicationReview: ReviewHandlers = {
	required: "always",
	deciders: "scope-managers",
	// An application has no page of its own: its election's scope, titled for the queue.
	async locate(ids) {
		return (await electionsService.locateApplications(ids)).map((a) => ({
			id: a.id,
			scopeId: a.scopeId,
			title: t("elections.review.applicationTitle", {
				position: a.positionTitle,
				election: a.cycleTitle,
			}),
		}));
	},
	async onApproved(_ctx, { id, comment }) {
		await electionsService.updateApplicationStatus(
			id,
			"approved",
			comment ?? undefined,
		);
	},
	async onRejected(_ctx, { id, comment }) {
		await electionsService.updateApplicationStatus(
			id,
			"rejected",
			comment ?? undefined,
		);
	},
};

export const applicationRef = (id: string) => `elections:application:${id}`;

/** Puts a new application into the Reviews queue, with its answers for the reviewers. */
export async function submitApplicationForReview(
	userId: string,
	application: {
		id: string;
		motivationWhy: string;
		motivationExperience: string;
		motivationGoals: string;
	},
): Promise<void> {
	await reviews.submit({ userId }, applicationRef(application.id), {
		details: [
			{
				question: t("elections.review.why"),
				answer: application.motivationWhy,
			},
			{
				question: t("elections.review.experience"),
				answer: application.motivationExperience,
			},
			{
				question: t("elections.review.goals"),
				answer: application.motivationGoals,
			},
		],
	});
}
