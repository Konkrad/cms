import { component$ } from "@qwik.dev/core";

/** The review state of an unpublished item, for admin lists (with the reviewer's comment). */
export const ReviewStatusBadge = component$<{
	review: { status: string; comment: string | null } | null;
}>(({ review }) => {
	if (!review) return <span>Not published</span>;
	const label =
		review.status === "in_review"
			? "In review"
			: review.status === "rejected"
				? "Not approved"
				: "Not published";
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
					“{review.comment}” Edit and save to submit it again.
				</span>
			)}
		</span>
	);
});
