import { component$ } from "@qwik.dev/core";
import { t } from "~/core/i18n";

/** The review state of an unpublished item, for admin lists (with the reviewer's comment). */
export const ReviewStatusBadge = component$<{
	review: { status: string; comment: string | null } | null;
}>(({ review }) => {
	if (!review)
		return <span>{t("core.reviews.reviewStatusBadge.notPublished")}</span>;
	const label =
		review.status === "in_review"
			? t("core.reviews.status.inReview")
			: review.status === "rejected"
				? t("core.reviews.status.rejected")
				: t("core.reviews.status.notPublished");
	return (
		<span data-review-status={review.status}>
			<span
				class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
					review.status === "rejected"
						? "bg-red-100 text-red-800"
						: "bg-amber-100 text-amber-800"
				}`}
			>
				{label}
			</span>
			{review.status === "rejected" && review.comment && (
				<span class="block mt-1 text-xs text-gray-600 whitespace-pre-wrap">
					{t("core.reviews.reviewStatusBadge.editAndSaveToSubmit", {
						comment: review.comment,
					})}
				</span>
			)}
		</span>
	);
});
