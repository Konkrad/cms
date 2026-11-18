import { answerRows } from "~/core/forms/answers";
import { formsService } from "~/core/forms/forms.service";
import { forms } from "~/core/forms/forms-api";
import { t } from "~/core/i18n";
import { notify } from "~/core/notifications/notify";
import { locateRef } from "~/core/registry/refs";
import type { ReviewHook } from "~/core/reviews/define";
import {
	type Review,
	type ReviewStatus,
	reviewsService,
} from "~/core/reviews/reviews.service";
import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import {
	type AccessUser,
	canManageScope,
	getAncestors,
	isPlatformAdmin,
} from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";

/**
 * Reviews (spec 4.9): public content from a chapter is published only after approval. Core
 * decides whether an item needs review, keeps one `reviews` row per submission, emails the
 * reviewers, and after a decision calls the owner's `onApproved` / `onRejected` handler
 * (named, queued in `handler_calls`, retried until it succeeds). Server-only.
 */

/** Bad input for a review (unknown item, already in review, a rejection without comment). */
export class ReviewError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ReviewError";
	}
}

/** The user may not decide this submission. */
export class ReviewAccessError extends Error {
	constructor() {
		super(t("core.reviews.cannotDecide"));
		this.name = "ReviewAccessError";
	}
}

/**
 * Whether new content needs review: public visibility (an item type without a visibility counts
 * as public) and an author below coordinator, admin or moderator of the owning scope (roles
 * inherit downward, so a coordinator of any scope above skips review too).
 */
export async function reviewRequired(
	author: AccessUser,
	scopeId: string,
	visibility: string | null,
): Promise<boolean> {
	if (visibility !== null && visibility !== "public") return false;
	return !(await canManageScope(author, scopeId, "coordinator"));
}

/**
 * Whether the user may decide a submission: never their own; root admins (and moderators) may;
 * otherwise a coordinator, admin or moderator role on a scope strictly ABOVE the item's scope.
 * The item's own representatives cannot (a representative role on the item's own scope
 * excludes, whatever else the user holds below the root).
 */
export async function canDecide(
	user: AccessUser,
	review: Pick<Review, "scopeId" | "submittedBy">,
): Promise<boolean> {
	if (!user || user.id === review.submittedBy) return false;
	if (await isPlatformAdmin(user)) return true;
	const ownRoles = await scopesService.getDirectRoles(user.id, review.scopeId);
	if (ownRoles.has("representative")) return false;
	const ancestors = await getAncestors(review.scopeId);
	const parent = ancestors.at(-1);
	return !!parent && canManageScope(user, parent.id, "coordinator");
}

/**
 * Who gets `reviews.requested`: the coordinators (direct role) of the nearest scope above the
 * item's scope that has any; the root admins when no scope above has coordinators. Never the
 * submitter.
 */
export async function reviewRecipients(
	scopeId: string,
	submittedBy: string,
): Promise<string[]> {
	const ancestors = (await getAncestors(scopeId)).reverse();
	for (const scope of ancestors) {
		const coordinators = (await scopesService.listRoleHolders(scope.id))
			.filter((h) => h.role === "coordinator" && h.id !== submittedBy)
			.map((h) => h.id);
		if (coordinators.length) return [...new Set(coordinators)];
	}
	const root = ancestors.at(-1) ?? (await scopesService.getRoot());
	if (!root) return [];
	return [
		...new Set(
			(await scopesService.listRoleHolders(root.id))
				.filter((h) => h.role === "admin" && h.id !== submittedBy)
				.map((h) => h.id),
		),
	];
}

/** The current review state of an item, for its admin page. */
export interface ReviewStatusInfo {
	reviewId: string;
	status: ReviewStatus;
	comment: string | null;
	submittedAt: string;
	decidedAt: string | null;
}

const statusInfo = (r: Review): ReviewStatusInfo => ({
	reviewId: r.id,
	status: r.status,
	comment: r.comment,
	submittedAt: r.createdAt,
	decidedAt: r.decidedAt,
});

const ownerOf = (ref: string) => {
	const [module, type] = ref.split(":");
	return { owner: module, type };
};

/** The module API (`reviews` from `~/core`). */
export const reviews = {
	/**
	 * Submits an item for review after the caller saved it unpublished. Returns `{ required }`:
	 * false when no review is needed (not public, the author is a coordinator or admin of the
	 * owning scope or above, or the item was approved before: edits are not reviewed), and the
	 * caller publishes directly. With `formId`, the answers are validated against that form and
	 * stored as a form result attached to the item in any case. Throws `ReviewError` for an
	 * unknown item or one that is already in review, `FormAnswerError` for invalid answers.
	 */
	async submit(
		ctx: { userId: string },
		ref: string,
		input: { formId?: string | null; answers?: unknown } = {},
	): Promise<{ required: boolean; reviewId: string | null }> {
		const item = await locateRef(ref);
		if (!item) throw new ReviewError(t("core.reviews.unknownItem"));
		const latest = await reviewsService.latestFor(ref);
		if (latest?.status === "in_review")
			throw new ReviewError(t("core.reviews.alreadyWaiting"));
		const answers = input.formId
			? (
					await forms.submit(ctx, input.formId, {
						subjectRef: ref,
						answers: input.answers ?? {},
					})
				).answers
			: null;
		const required =
			!(await reviewsService.hasApproved(ref)) &&
			(await reviewRequired({ id: ctx.userId }, item.scopeId, item.visibility));
		if (!required) return { required: false, reviewId: null };
		const review = await reviewsService.create({
			ref,
			scopeId: item.scopeId,
			submittedBy: ctx.userId,
			data: answers,
			formId: input.formId ?? null,
		});
		const to = await reviewRecipients(item.scopeId, ctx.userId);
		if (to.length)
			await notify("reviews.requested", { to, data: { reviewId: review.id } });
		return { required: true, reviewId: review.id };
	},

	/**
	 * Whether submitting the item now would need a review (the rule of `submit`, without
	 * submitting): lets a module keep a new item as a draft and ask for its proposal form first.
	 */
	async isRequired(ctx: { userId: string }, ref: string): Promise<boolean> {
		const item = await locateRef(ref);
		if (!item) throw new ReviewError(t("core.reviews.unknownItem"));
		if (await reviewsService.hasApproved(ref)) return false;
		return reviewRequired({ id: ctx.userId }, item.scopeId, item.visibility);
	},

	/** Whether the user may decide the item's pending submission (to preview a hidden item). */
	async canReview(user: AccessUser, ref: string): Promise<boolean> {
		const latest = await reviewsService.latestFor(ref);
		return latest?.status === "in_review" && canDecide(user, latest);
	},

	/**
	 * Who reviews an item's follow-ups (its debrief): the coordinator who approved it, or, for an
	 * item that was never reviewed, the reviewers a new submission would go to. Never `exceptUserId`.
	 */
	async reviewersOf(ref: string, exceptUserId: string): Promise<string[]> {
		const approved = await reviewsService.latestApproved(ref);
		if (approved?.reviewedBy && approved.reviewedBy !== exceptUserId)
			return [approved.reviewedBy];
		const item = await locateRef(ref);
		return item ? reviewRecipients(item.scopeId, exceptUserId) : [];
	},

	/** The latest submission of an item (null when it was never submitted). */
	async statusOf(ref: string): Promise<ReviewStatusInfo | null> {
		const latest = await reviewsService.latestFor(ref);
		return latest ? statusInfo(latest) : null;
	},

	/** `statusOf` for many items at once, by ref. */
	async statusOfMany(
		refs: readonly string[],
	): Promise<Map<string, ReviewStatusInfo>> {
		const latest = await reviewsService.latestForMany(refs);
		return new Map([...latest].map(([ref, r]) => [ref, statusInfo(r)]));
	},
};

/**
 * Approves or rejects a submission that is in review (core's review queue). Rejecting needs a
 * comment. Queues the owner's handler call (once per decision) and tells the author.
 */
export async function decideReview(
	user: { id: string },
	reviewId: string,
	decision: { approve: boolean; comment?: string | null },
): Promise<Review> {
	const review = await reviewsService.getById(reviewId);
	if (!review || review.status !== "in_review")
		throw new ReviewError(t("core.reviews.notWaiting"));
	if (!(await canDecide(user, review))) throw new ReviewAccessError();
	const comment = decision.comment?.trim() || null;
	if (!decision.approve && !comment)
		throw new ReviewError(t("core.reviews.commentRequired"));
	const decided = await reviewsService.decide(review.id, {
		status: decision.approve ? "approved" : "rejected",
		reviewedBy: user.id,
		comment,
	});
	if (!decided) throw new ReviewError(t("core.reviews.decidedMeanwhile"));
	const hook: ReviewHook = decision.approve ? "onApproved" : "onRejected";
	const { owner, type } = ownerOf(review.ref);
	await handlerCallsService.enqueue({
		dedupeKey: `review:${review.id}`,
		owner,
		kind: "reviews",
		type,
		hook,
		payload: {
			id: review.ref.split(":").slice(2).join(":"),
			ref: review.ref,
			reviewId: review.id,
			submittedBy: review.submittedBy,
			reviewedBy: user.id,
			comment,
			data: review.data ?? null,
		},
	});
	await notify("reviews.decided", {
		to: review.submittedBy,
		data: { reviewId: review.id },
	});
	return decided;
}

/** The answers stored with a submission as text rows (in the form's question order). */
async function answersOf(
	review: Pick<Review, "data" | "formId">,
): Promise<Array<{ question: string; answer: string }>> {
	if (!review.data) return [];
	const form = review.formId
		? await formsService.getById(review.formId)
		: undefined;
	return answerRows(form?.schema ?? { pages: [] }, review.data).map(
		({ question, answer }) => ({ question, answer }),
	);
}

/** A row of the admin review queue. */
export interface ReviewQueueItem {
	reviewId: string;
	ref: string;
	title: string;
	url: string | null;
	scopeId: string;
	status: ReviewStatus;
	submitterName: string;
	submittedAt: string;
	comment: string | null;
	decidedAt: string | null;
	canDecide: boolean;
	/** The answers submitted with it (an event proposal), as plain-text rows. */
	answers: Array<{ question: string; answer: string }>;
}

/**
 * The review queue of a scope's admin: submissions in review in the scope's subtree that the
 * viewer may decide, and the viewer's own submissions there (any status), newest first.
 */
export async function reviewQueue(
	viewer: { id: string },
	scope: Scope,
): Promise<{ pending: ReviewQueueItem[]; mine: ReviewQueueItem[] }> {
	const subtree = await scopesService.subtreeIds(scope.id);
	const [inReview, mine] = await Promise.all([
		reviewsService.listInScopes(subtree, { status: "in_review" }),
		reviewsService.listInScopes(subtree, { submittedBy: viewer.id, limit: 50 }),
	]);
	const { locateRef: locate, resolveRef } = await import(
		"~/core/registry/refs"
	);
	const toItem = async (
		r: (typeof inReview)[number],
		decidable: boolean,
	): Promise<ReviewQueueItem> => {
		const [item, url] = await Promise.all([locate(r.ref), resolveRef(r.ref)]);
		return {
			reviewId: r.id,
			ref: r.ref,
			title: item?.title ?? r.ref,
			url,
			scopeId: r.scopeId,
			status: r.status,
			submitterName: r.submitterName,
			submittedAt: r.createdAt,
			comment: r.comment,
			decidedAt: r.decidedAt,
			canDecide: decidable,
			answers: await answersOf(r),
		};
	};
	const decidable = await Promise.all(
		inReview.map((r) => canDecide(viewer, r)),
	);
	return {
		pending: await Promise.all(
			inReview.filter((_, i) => decidable[i]).map((r) => toItem(r, true)),
		),
		mine: await Promise.all(mine.map((r) => toItem(r, false))),
	};
}

/**
 * Adds each item's latest review (`{ status, comment }` or null) to admin list rows of core
 * notes or articles.
 */
export async function withReviewStatus<T extends { id: string }>(
	kind: "note" | "article",
	rows: T[],
): Promise<
	Array<T & { review: { status: ReviewStatus; comment: string | null } | null }>
> {
	const statuses = await reviews.statusOfMany(
		rows.map((r) => `core:${kind}:${r.id}`),
	);
	return rows.map((r) => {
		const s = statuses.get(`core:${kind}:${r.id}`);
		return {
			...r,
			review: s ? { status: s.status, comment: s.comment } : null,
		};
	});
}
