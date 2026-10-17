import { reviewRequired, reviews } from "~/core/reviews/reviews";
import { reviewsService } from "~/core/reviews/reviews.service";

/**
 * Notes and articles through review (spec 4.9). A new public item by an author below
 * coordinator of its scope is stored unpublished (`publishedAt` null) and submitted; the core
 * review handler publishes it on approval. Edits of approved items publish directly; a rejected
 * item is resubmitted when its author saves it again. Server-only.
 */

type Kind = "note" | "article";
type Item = {
	id: string;
	scopeId: string;
	visibility: string;
	publishedAt: string | null;
	authorId: string;
};

const refOf = (kind: Kind, id: string) => `core:${kind}:${id}`;

/**
 * After creating an unpublished item: submits it when it needs review. Returns whether to
 * publish it now (no review needed).
 */
export async function submitNewItem(
	kind: Kind,
	item: Item & { subjectType: string | null; subjectId: string | null },
	authorId: string,
	announcesReviewId?: string | null,
): Promise<boolean> {
	// An announcement of an approved item by its submitter (the event's "Post announcement")
	// was reviewed with the item.
	if (announcesReviewId) {
		const review = await reviewsService.getById(announcesReviewId);
		if (
			review?.status === "approved" &&
			review.submittedBy === authorId &&
			review.ref === `${item.subjectType}:${item.subjectId}`
		)
			return true;
	}
	const { required } = await reviews.submit(
		{ userId: authorId },
		refOf(kind, item.id),
	);
	return !required;
}

/**
 * After an edit: what happens to the item's publication.
 * - "publish": an unpublished, rejected item saved again needs no review any more (e.g. now
 *   members-only), or was never reviewed;
 * - "unpublish": a published item made public by an editor who needs review, never approved;
 * - "keep": everything else (in review, approved, published edits).
 * Submits (or resubmits) the item where needed.
 */
export async function reviewAfterEdit(
	kind: Kind,
	before: Item,
	after: Item,
	editorId: string,
): Promise<"publish" | "unpublish" | "keep"> {
	const ref = refOf(kind, after.id);
	const latest = await reviewsService.latestFor(ref);
	if (!after.publishedAt) {
		if (latest?.status === "in_review" || latest?.status === "approved")
			return "keep";
		// Rejected (or never submitted): saving it again resubmits it.
		const { required } = await reviews.submit({ userId: editorId }, ref);
		return required ? "keep" : "publish";
	}
	const madePublic =
		after.visibility === "public" && before.visibility !== "public";
	if (
		madePublic &&
		!(await reviewsService.hasApproved(ref)) &&
		(await reviewRequired({ id: editorId }, after.scopeId, "public"))
	) {
		await reviews.submit({ userId: editorId }, ref);
		return "unpublish";
	}
	return "keep";
}

/** Whether a viewer may preview an unpublished item: its author and whoever may decide its review. */
export async function canPreviewUnpublished(
	kind: Kind,
	item: Pick<Item, "id" | "authorId" | "publishedAt">,
	viewer: { id: string } | null,
): Promise<boolean> {
	if (!viewer || item.publishedAt) return false;
	if (viewer.id === item.authorId) return true;
	const latest = await reviewsService.latestFor(refOf(kind, item.id));
	if (latest?.status !== "in_review") return false;
	const { canDecide } = await import("~/core/reviews/reviews");
	return canDecide(viewer, latest);
}
