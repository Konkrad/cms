/**
 * Review handlers (spec 4.9, manifest `reviews: { [type]: { onApproved, onRejected } }`).
 * Client-safe (types only). Core calls them by name after a decision, retried until they
 * succeed (like payment handlers), so they must be safe to call again.
 */

/** What a handler is told about the decided item. */
export interface ReviewDecision {
	/** The item id (the `<id>` of `<module>:<type>:<id>`). */
	id: string;
	ref: string;
	reviewId: string;
	submittedBy: string;
	reviewedBy: string;
	/** The reviewer's comment (always set on a rejection). */
	comment: string | null;
	/** The answers submitted with the review (an event proposal), if any. */
	data: Record<string, unknown> | null;
}

export interface ReviewContext {
	now: Date;
}

export interface ReviewHandlers {
	/** Publish the item (it stayed hidden while in review). */
	onApproved?(ctx: ReviewContext, decision: ReviewDecision): Promise<void>;
	/** Back to draft; the author can edit and resubmit. */
	onRejected?(ctx: ReviewContext, decision: ReviewDecision): Promise<void>;
}

export type ReviewHook = keyof ReviewHandlers;
