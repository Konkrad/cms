import { answerRows } from "~/core/forms/answers";
import { formsService } from "~/core/forms/forms.service";
import { forms } from "~/core/forms/forms-api";
import { t } from "~/core/i18n";
import { notify } from "~/core/notifications/notify";
import { reviewTypeDefinition } from "~/core/registry/handlers";
import { locateRef, resolveRef } from "~/core/registry/refs";
import type {
	ReviewDeciders,
	ReviewHook,
	ReviewRequirement,
} from "~/core/reviews/define";
import {
	type Review,
	type ReviewStatus,
	reviewsService,
} from "~/core/reviews/reviews.service";
import { handlerCallsService } from "~/core/scheduler/handler-calls.service";
import {
	type AccessUser,
	ADMIN_ACCESS,
	canManageScope,
	getAncestors,
	isPlatformAdmin,
} from "~/core/scopes/access";
import type { Scope } from "~/core/scopes/schema/scopes";
import { scopesService } from "~/core/scopes/scopes.service";

/**
 * Reviews (spec 4.9): the one approval flow of the site. Public content from a chapter, job
 * listings and election applications are published only after approval. Core decides whether
 * an item needs review (by the item type's rule), keeps one `reviews` row per submission, emails
 * the reviewers, and after a decision calls the owner's `onApproved` / `onRejected` handler
 * (named, queued in `handler_calls`, retried until it succeeds). Server-only.
 */

/** The rules of an item type (`<owner>:<type>:<id>`), defaults for content. */
function policyOf(ref: string): {
	required: ReviewRequirement;
	deciders: ReviewDeciders;
} {
	const [owner, type] = ref.split(":");
	const def = reviewTypeDefinition(owner, type);
	return {
		required: def?.required ?? "public-content",
		deciders: def?.deciders ?? "above",
	};
}

/**
 * Where a reviewed item lives: the type's own `locate` (items without a page, such as election
 * applications), else its reference. Null when it is gone.
 */
export async function locateReviewItem(ref: string): Promise<{
	scopeId: string;
	title: string | null;
	visibility: string | null;
} | null> {
	const [owner, type, ...rest] = ref.split(":");
	const def = reviewTypeDefinition(owner, type);
	if (def?.locate) {
		const [item] = await def.locate([rest.join(":")]);
		return item
			? {
					scopeId: item.scopeId,
					title: item.title,
					visibility: item.visibility ?? null,
				}
			: null;
	}
	const item = await locateRef(ref);
	return item
		? { scopeId: item.scopeId, title: item.title, visibility: item.visibility }
		: null;
}

/** The item's page, when it has one (items located by their review type have none). */
export async function reviewItemUrl(ref: string): Promise<string | null> {
	const [owner, type] = ref.split(":");
	if (reviewTypeDefinition(owner, type)?.locate) return null;
	return resolveRef(ref);
}

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
	rule: ReviewRequirement = "public-content",
): Promise<boolean> {
	if (rule === "always") return true;
	if (rule === "unless-manager")
		return !(await canManageScope(author, scopeId, ADMIN_ACCESS));
	if (visibility !== null && visibility !== "public") return false;
	return !(await canManageScope(author, scopeId, "coordinator"));
}

/**
 * Whether the user may decide a submission: never their own; root admins (and moderators) may;
 * otherwise a coordinator, admin or moderator role on a scope strictly ABOVE the item's scope.
 * The item's own representatives cannot (a representative role on the item's own scope
 * excludes, whatever else the user holds below the root). With `"scope-managers"` deciders:
 * an admin, moderator or representative role on the item's scope or above.
 */
export async function canDecide(
	user: AccessUser,
	review: Pick<Review, "scopeId" | "submittedBy">,
	deciders: ReviewDeciders = "above",
): Promise<boolean> {
	if (!user || user.id === review.submittedBy) return false;
	if (await isPlatformAdmin(user)) return true;
	if (deciders === "scope-managers")
		return canManageScope(user, review.scopeId, ADMIN_ACCESS);
	const ownRoles = await scopesService.getDirectRoles(user.id, review.scopeId);
	if (ownRoles.has("representative")) return false;
	const ancestors = await getAncestors(review.scopeId);
	const parent = ancestors.at(-1);
	return !!parent && canManageScope(user, parent.id, "coordinator");
}

/** Direct role holders a request goes to, by deciders rule. */
const REQUEST_ROLES: Record<ReviewDeciders, readonly string[]> = {
	above: ["coordinator"],
	"scope-managers": ["admin", "moderator", "representative"],
};

/**
 * Who gets `reviews.requested`: with `"above"` deciders, the coordinators (direct role) of the
 * nearest scope above the item's scope that has any; with `"scope-managers"`, the admins,
 * moderators and representatives of the nearest scope, starting with the item's own, that has
 * any. The root admins when nobody else qualifies. Never the submitter.
 */
export async function reviewRecipients(
	scopeId: string,
	submittedBy: string,
	deciders: ReviewDeciders = "above",
): Promise<string[]> {
	const ancestors = (await getAncestors(scopeId)).reverse();
	if (deciders === "scope-managers") {
		const own = await scopesService.getById(scopeId);
		if (own) ancestors.unshift(own);
	}
	const roles = REQUEST_ROLES[deciders];
	for (const scope of ancestors) {
		const coordinators = (await scopesService.listRoleHolders(scope.id))
			.filter((h) => roles.includes(h.role) && h.id !== submittedBy)
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

/**
 * Whether a submission of this item by this author needs review: the type's rule; for content,
 * edits of an item approved before are not reviewed again.
 */
async function requiredFor(
	userId: string,
	ref: string,
	item: { scopeId: string; visibility: string | null },
): Promise<boolean> {
	const { required } = policyOf(ref);
	if (required === "public-content" && (await reviewsService.hasApproved(ref)))
		return false;
	return reviewRequired(
		{ id: userId },
		item.scopeId,
		item.visibility,
		required,
	);
}

/** The module API (`reviews` from `~/core`). */
export const reviews = {
	/**
	 * Submits an item for review after the caller saved it unpublished. Returns `{ required }`:
	 * false when no review is needed (not public, the author is a coordinator or admin of the
	 * owning scope or above, or the item was approved before: edits are not reviewed), and the
	 * caller publishes directly. With `formId`, the answers are validated against that form and
	 * stored as a form result attached to the item in any case. Throws `ReviewError` for an
	 * unknown item or one that is already in review, `FormAnswerError` for invalid answers.
	 * `details` are labelled answers that are not a form (an election application's motivation),
	 * shown to the reviewers like form answers. The item type's `required` rule replaces the
	 * content rule; with `"always"` and `"unless-manager"` every new submission is checked,
	 * approved before or not.
	 */
	async submit(
		ctx: { userId: string },
		ref: string,
		input: {
			formId?: string | null;
			answers?: unknown;
			details?: Array<{ question: string; answer: string }>;
		} = {},
	): Promise<{ required: boolean; reviewId: string | null }> {
		const item = await locateReviewItem(ref);
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
			: input.details?.length
				? Object.fromEntries(input.details.map((d) => [d.question, d.answer]))
				: null;
		const required = await requiredFor(ctx.userId, ref, item);
		if (!required) return { required: false, reviewId: null };
		const review = await reviewsService.create({
			ref,
			scopeId: item.scopeId,
			submittedBy: ctx.userId,
			data: answers,
			formId: input.formId ?? null,
		});
		const to = await reviewRecipients(
			item.scopeId,
			ctx.userId,
			policyOf(ref).deciders,
		);
		if (to.length)
			await notify("reviews.requested", { to, data: { reviewId: review.id } });
		return { required: true, reviewId: review.id };
	},

	/**
	 * Whether submitting the item now would need a review (the rule of `submit`, without
	 * submitting): lets a module keep a new item as a draft and ask for its proposal form first.
	 */
	async isRequired(ctx: { userId: string }, ref: string): Promise<boolean> {
		const item = await locateReviewItem(ref);
		if (!item) throw new ReviewError(t("core.reviews.unknownItem"));
		return requiredFor(ctx.userId, ref, item);
	},

	/** Whether the user may decide the item's pending submission (to preview a hidden item). */
	async canReview(user: AccessUser, ref: string): Promise<boolean> {
		const latest = await reviewsService.latestFor(ref);
		return (
			latest?.status === "in_review" &&
			canDecide(user, latest, policyOf(ref).deciders)
		);
	},

	/**
	 * Who reviews an item's follow-ups (its debrief): the coordinator who approved it, or, for an
	 * item that was never reviewed, the reviewers a new submission would go to. Never `exceptUserId`.
	 */
	async reviewersOf(ref: string, exceptUserId: string): Promise<string[]> {
		const approved = await reviewsService.latestApproved(ref);
		if (approved?.reviewedBy && approved.reviewedBy !== exceptUserId)
			return [approved.reviewedBy];
		const item = await locateReviewItem(ref);
		return item
			? reviewRecipients(item.scopeId, exceptUserId, policyOf(ref).deciders)
			: [];
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
	if (!(await canDecide(user, review, policyOf(review.ref).deciders)))
		throw new ReviewAccessError();
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
	const announced =
		decision.approve &&
		reviewTypeDefinition(owner, type)?.announcesApproval === true;
	if (!announced)
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
	// Labelled details (no form): the labels are the questions.
	if (!review.formId)
		return Object.entries(review.data).map(([question, answer]) => ({
			question,
			answer: String(answer ?? ""),
		}));
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
	const gone = new Map<string, boolean>();
	const toItem = async (
		r: (typeof inReview)[number],
		decidable: boolean,
	): Promise<ReviewQueueItem> => {
		const [item, url] = await Promise.all([
			locateReviewItem(r.ref),
			reviewItemUrl(r.ref),
		]);
		gone.set(r.id, !item);
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
		inReview.map((r) => canDecide(viewer, r, policyOf(r.ref).deciders)),
	);
	return {
		// A submission whose item was deleted meanwhile has nothing left to decide.
		pending: (
			await Promise.all(
				inReview.filter((_, i) => decidable[i]).map((r) => toItem(r, true)),
			)
		).filter((item) => !gone.get(item.reviewId)),
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
