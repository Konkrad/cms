import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { formatDate, t } from "~/core/i18n";
import {
	decideReview,
	ReviewAccessError,
	ReviewError,
	reviewQueue,
} from "~/core/reviews/reviews";
import { reviewsService } from "~/core/reviews/reviews.service";
import {
	REVIEW_ACCESS,
	requireScopeRole,
	requireWithinScope,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

/**
 * The review queue of a scope (spec 4.9): items in review in the scope's subtree that the
 * viewer may decide (coordinators and admins above the item's scope, root admins; never the
 * item's own representatives or the submitter), and the viewer's own submissions with the
 * reviewer's comment.
 */
export const useReviewQueue = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, REVIEW_ACCESS);
	return assertNoPrivateFields(await reviewQueue(user, scope));
});

/** Approves, or rejects with a comment, one submission of this scope's subtree. */
export const useDecideReview = routeAction$(
	async (data, event) => {
		const { user, scope } = await requireScopeRole(event, REVIEW_ACCESS);
		await requireWithinScope(
			event,
			scope,
			await reviewsService.getById(data.reviewId),
		);
		try {
			await decideReview(user, data.reviewId, {
				approve: data.decision === "approve",
				comment: data.comment,
			});
		} catch (error) {
			if (error instanceof ReviewError || error instanceof ReviewAccessError)
				return event.fail(400, { message: error.message });
			throw error;
		}
		return { success: true, decision: data.decision };
	},
	zod$({
		reviewId: z.string().min(1),
		decision: z.enum(["approve", "reject"]),
		comment: z.string().max(2000).optional(),
	}),
);

const STATUS_LABELS: Record<string, string> = {
	draft: t("admin.reviews.status.draft"),
	in_review: t("admin.reviews.status.inReview"),
	approved: t("admin.reviews.status.approved"),
	rejected: t("admin.reviews.status.rejected"),
};

export default component$(() => {
	const queue = useReviewQueue();
	const decide = useDecideReview();
	const { pending, mine } = queue.value;

	return (
		<div>
			<h2 class="text-2xl font-bold text-gray-800 mb-2">
				{t("admin.reviews.reviews")}
			</h2>
			<p class="text-sm text-gray-500 mb-6">
				{t("admin.reviews.publicContentFromTheGroups")}
			</p>
			{decide.value?.failed && (
				<p class="mb-4 text-sm text-red-700" role="alert">
					{decide.value.message}
				</p>
			)}

			<section class="mb-10" data-testid="review-queue">
				<h3 class="text-lg font-semibold mb-3">
					{t("admin.reviews.waitingForYourDecision")}
				</h3>
				{pending.length === 0 ? (
					<div class="bg-white rounded-lg shadow-sm px-5 py-8 text-center text-gray-400 text-sm">
						{t("admin.reviews.nothingToReview")}
					</div>
				) : (
					<ul class="space-y-4">
						{pending.map((item) => (
							<li
								key={item.reviewId}
								class="bg-white rounded-lg shadow-sm p-5"
								data-review-id={item.reviewId}
								data-ref={item.ref}
							>
								<div class="flex flex-wrap justify-between gap-2 mb-2">
									<div>
										<p class="font-semibold">
											{item.url ? (
												<a
													href={item.url}
													class="text-blue-700 hover:underline"
													target="_blank"
												>
													{item.title}
												</a>
											) : (
												item.title
											)}
										</p>
										<p class="text-xs text-gray-500">
											{item.submitterName} ·{" "}
											{formatDate(item.submittedAt, "dateTime")}
										</p>
									</div>
								</div>
								{item.answers.length > 0 && (
									<dl class="text-sm mb-4 grid gap-2">
										{item.answers.map((a) => (
											<div key={a.question}>
												<dt class="font-medium text-gray-700">{a.question}</dt>
												<dd class="text-gray-600 whitespace-pre-wrap">
													{a.answer}
												</dd>
											</div>
										))}
									</dl>
								)}
								<Form action={decide} class="flex flex-col gap-2">
									<input type="hidden" name="reviewId" value={item.reviewId} />
									<label class="text-sm text-gray-700">
										{t("admin.reviews.commentRequiredToReject")}
										<textarea
											name="comment"
											rows={2}
											class="mt-1 w-full border border-gray-300 rounded-sm px-2 py-1"
										/>
									</label>
									<div class="flex gap-3">
										<button
											type="submit"
											name="decision"
											value="approve"
											class="px-4 py-2 rounded-sm bg-green-700 text-white text-sm font-medium"
										>
											{t("admin.reviews.approve")}
										</button>
										<button
											type="submit"
											name="decision"
											value="reject"
											class="px-4 py-2 rounded-sm bg-red-700 text-white text-sm font-medium"
										>
											{t("admin.reviews.reject")}
										</button>
									</div>
								</Form>
							</li>
						))}
					</ul>
				)}
			</section>

			<section data-testid="my-submissions">
				<h3 class="text-lg font-semibold mb-3">
					{t("admin.reviews.yourSubmissions")}
				</h3>
				{mine.length === 0 ? (
					<div class="bg-white rounded-lg shadow-sm px-5 py-8 text-center text-gray-400 text-sm">
						{t("admin.reviews.youHaveNotSubmittedAnything")}
					</div>
				) : (
					<ul class="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
						{mine.map((item) => (
							<li
								key={item.reviewId}
								class="px-5 py-3 text-sm"
								data-review-id={item.reviewId}
								data-ref={item.ref}
							>
								<div class="flex flex-wrap justify-between gap-2">
									<span class="font-medium">{item.title}</span>
									<span class="text-gray-600">
										{STATUS_LABELS[item.status]} ·{" "}
										{formatDate(item.decidedAt ?? item.submittedAt, "dateTime")}
									</span>
								</div>
								{item.comment && (
									<p class="mt-1 text-gray-700 whitespace-pre-wrap">
										“{item.comment}”
									</p>
								)}
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
});
