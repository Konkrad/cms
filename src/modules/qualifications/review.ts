import type { ReviewHandlers } from "~/core";
import { qualificationsService } from "./service";

/**
 * Pending qualification claims go through core's review flow (manifest `reviews.claim`): an
 * admin, moderator or representative of the qualification's scope (the root) approves or
 * rejects them in the Reviews queue. Approval raises the member's tier and gives the badge;
 * a rejection keeps the reviewer's comment on the claim. A QR code redeemed in person is
 * approved at once (its creator vouched for it) and never queued. Core calls the handlers
 * after a decision and retries them until they succeed, so both are safe to call again.
 * Server-only.
 */
export const claimReview: ReviewHandlers = {
	required: "always",
	deciders: "scope-managers",
	// A claim has no page of its own: its qualification's scope, titled with its label.
	async locate(ids) {
		return (await qualificationsService.locateClaims(ids)).map((c) => ({
			id: c.id,
			scopeId: c.scopeId,
			title: c.label,
		}));
	},
	async onApproved(_ctx, { id, reviewedBy, comment }) {
		await qualificationsService.approve(id, reviewedBy, comment ?? undefined);
	},
	async onRejected(_ctx, { id, reviewedBy, comment }) {
		await qualificationsService.reject(id, reviewedBy, comment ?? "");
	},
};

export const claimRef = (id: string) => `qualifications:claim:${id}`;
