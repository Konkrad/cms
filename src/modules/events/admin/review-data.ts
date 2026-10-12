import type { RequestEventLoader } from "@qwik.dev/router";
import { forms, itemUrl, reviews } from "~/core";
import { requireAdminEvent } from "./event-guards";

/**
 * Server-only: import from route loaders only, never from components.
 * The event's review state (spec 5.2): its status, the latest review with the reviewer's
 * comment, the active proposal form while it is a draft, and the proposal and debrief answers
 * stored with it (form results by the event's ref; managers of its scope only).
 */
export async function loadAdminEventReview(event: RequestEventLoader) {
	const { user, event: target } = await requireAdminEvent(event, {
		onMissing: "redirect",
	});
	const ref = `events:event:${target.id}`;
	const [review, proposal, results] = await Promise.all([
		reviews.statusOf(ref),
		target.status === "draft"
			? forms.active({ scopeId: target.scopeId }, "events.proposal")
			: null,
		forms.resultsFor({ userId: user.id }, ref),
	]);
	return {
		event: {
			id: target.id,
			title: target.title,
			status: target.status,
			visibility: target.visibility,
			announceOnApproval: target.announceOnApproval,
			url: await itemUrl("events:event", target),
		},
		review,
		proposalForm: proposal
			? {
					id: proposal.id,
					title: proposal.title,
					description: proposal.description,
					questions: proposal.questions,
				}
			: null,
		results: results.map((r) => ({
			id: r.id,
			formTitle: r.formTitle,
			purpose: r.purpose,
			createdAt: r.createdAt,
			authorName: r.authorName,
			rows: r.rows,
		})),
	};
}

export type AdminEventReviewData = Awaited<
	ReturnType<typeof loadAdminEventReview>
>;
