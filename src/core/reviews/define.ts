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

/**
 * When a submission needs review.
 * - `"public-content"` (default): the item is public and its author holds no coordinator, admin
 *   or moderator role on the owning scope or above (notes, articles, events).
 * - `"unless-manager"`: unless the author may manage the owning scope (admin, moderator or
 *   representative there or above), whatever the visibility (jobs).
 * - `"always"`: every submission (election applications).
 */
export type ReviewRequirement = "public-content" | "unless-manager" | "always";

/**
 * Who decides a submission (never its submitter; admins and moderators of the root always may).
 * - `"above"` (default): coordinators, admins and moderators of a scope strictly ABOVE the item's
 *   scope; the item's own representatives may not (content travels up, so someone above approves).
 * - `"scope-managers"`: admins, moderators and representatives of the item's scope or above
 *   (the scope's own managers approve; coordinators may not).
 */
export type ReviewDeciders = "above" | "scope-managers";

/** Where a reviewed item lives, for item types without a page of their own. */
export interface ReviewItemLocation {
	id: string;
	scopeId: string;
	/** Shown in the review queue and the emails. */
	title: string;
	visibility?: string;
}

export interface ReviewHandlers {
	/** When a submission needs review (default `"public-content"`). */
	required?: ReviewRequirement;
	/** Who decides (default `"above"`). */
	deciders?: ReviewDeciders;
	/**
	 * `true` when `onApproved` tells the submitter itself (jobs: their optional "job approved"
	 * email); core then emails only rejections. Default: core emails every decision.
	 */
	announcesApproval?: boolean;
	/**
	 * Locates items that are not references (an election application has no page): scope and
	 * title for the queue. Default: the module's `refs` entry of the same type.
	 */
	locate?(ids: readonly string[]): Promise<ReviewItemLocation[]>;
	/** Publish the item (it stayed hidden while in review). */
	onApproved?(ctx: ReviewContext, decision: ReviewDecision): Promise<void>;
	/** Back to draft; the author can edit and resubmit. */
	onRejected?(ctx: ReviewContext, decision: ReviewDecision): Promise<void>;
}

export type ReviewHook = keyof ReviewHandlers;
