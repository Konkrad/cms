import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import { FormAnswerError, forms, notify, ReviewError, reviews } from "~/core";
import { Button, FormRenderer } from "~/core/ui";
import { DEBRIEF_PURPOSE } from "../debrief";
import { eventsService } from "../services/events";
import { requireAdminEvent } from "./event-guards";
import type { AdminEventReviewData } from "./review-data";

const answersSchema = z
	.record(z.string(), z.union([z.string(), z.array(z.string())]))
	.optional();

/**
 * Submits a draft event with the active proposal form's answers (spec 5.2). Core decides
 * whether a review is needed: if so the event waits in review (the coordinators above are
 * emailed), otherwise it is published at once.
 */
export const useSubmitProposal = routeAction$(
	async (data, requestEvent) => {
		const { user, event } = await requireAdminEvent(requestEvent);
		if (event.status !== "draft")
			return requestEvent.fail(400, {
				message: "Only a draft event can be submitted",
				fieldErrors: {} as Record<string, string>,
			});
		const ref = `events:event:${event.id}`;
		const form = await forms.active(
			{ scopeId: event.scopeId },
			"events.proposal",
		);
		await eventsService.setAnnounceOnApproval(event.id, data.announce === "on");
		let required: boolean;
		try {
			({ required } = await reviews.submit(
				{ userId: user.id },
				ref,
				form ? { formId: form.id, answers: data.answers ?? {} } : {},
			));
		} catch (error) {
			if (error instanceof FormAnswerError)
				return requestEvent.fail(400, {
					message: error.message,
					fieldErrors: error.fieldErrors,
				});
			if (error instanceof ReviewError)
				return requestEvent.fail(400, {
					message: error.message,
					fieldErrors: {} as Record<string, string>,
				});
			throw error;
		}
		await eventsService.setStatus(
			event.id,
			required ? "in_review" : "published",
		);
		return { success: true, inReview: required };
	},
	zod$({ answers: answersSchema, announce: z.string().optional() }),
);

/** Stores the organiser's debrief (the active `events.debrief` form) and tells the reviewer. */
export const useSubmitDebrief = routeAction$(
	async (data, requestEvent) => {
		const { user, event } = await requireAdminEvent(requestEvent);
		const ref = `events:event:${event.id}`;
		const form = await forms.active(
			{ scopeId: event.scopeId },
			DEBRIEF_PURPOSE,
		);
		if (
			!form ||
			event.status !== "published" ||
			new Date(event.endDate).getTime() > Date.now() ||
			(await forms.hasResult(ref, DEBRIEF_PURPOSE))
		)
			return requestEvent.fail(400, {
				message: "There is no debrief to fill in for this event",
				fieldErrors: {} as Record<string, string>,
			});
		try {
			await forms.submit({ userId: user.id }, form.id, {
				subjectRef: ref,
				answers: data.answers ?? {},
			});
		} catch (error) {
			if (error instanceof FormAnswerError)
				return requestEvent.fail(400, {
					message: error.message,
					fieldErrors: error.fieldErrors,
				});
			throw error;
		}
		const to = await reviews.reviewersOf(ref, user.id);
		if (to.length)
			await notify("events.debrief-submitted", {
				to,
				data: { eventId: event.id },
			});
		return { success: true };
	},
	zod$({ answers: answersSchema }),
);

const STATUS_TEXT: Record<string, string> = {
	draft: "Draft: not visible publicly.",
	in_review:
		"In review: the coordinators above were asked to approve it. It is published once approved.",
	published: "Published.",
};

type Props = { data: AdminEventReviewData };

export const AdminEventReview = component$<Props>(({ data }) => {
	const submit = useSubmitProposal();
	const debrief = useSubmitDebrief();
	const debriefFailed = debrief.value?.failed ? debrief.value : null;
	const failed = submit.value?.failed ? submit.value : null;
	return (
		<div class="space-y-6">
			<section
				class="bg-white rounded-lg shadow-sm p-6"
				data-testid="event-review-status"
			>
				<h3 class="text-lg font-semibold mb-2">Status</h3>
				<p class="text-sm text-gray-700" data-event-status={data.event.status}>
					{STATUS_TEXT[data.event.status]}
				</p>
				{data.review?.status === "rejected" && data.review.comment && (
					<div class="mt-3 p-3 rounded-sm bg-red-50 border border-red-200 text-sm text-red-800">
						<p class="font-medium">Not approved. The reviewer wrote:</p>
						<p class="whitespace-pre-wrap" data-testid="review-comment">
							{data.review.comment}
						</p>
					</div>
				)}
				{submit.value?.success && (
					<output class="block mt-3 text-sm text-green-700">
						{submit.value.inReview ? "Sent for review." : "Published."}
					</output>
				)}
			</section>

			{data.event.status === "draft" && (
				<section
					class="bg-white rounded-lg shadow-sm p-6"
					data-testid="event-proposal"
				>
					<h3 class="text-lg font-semibold mb-1">
						{data.proposalForm?.title ?? "Submit the event"}
					</h3>
					{data.proposalForm?.description && (
						<p class="text-sm text-gray-500 mb-4">
							{data.proposalForm.description}
						</p>
					)}
					{failed?.message && (
						<p class="mb-4 text-sm text-red-700" role="alert">
							{failed.message}
						</p>
					)}
					<Form action={submit} class="space-y-5">
						{data.proposalForm && (
							<FormRenderer
								questions={data.proposalForm.questions}
								errors={
									failed?.fieldErrors as Record<string, string> | undefined
								}
							/>
						)}
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								name="announce"
								checked={data.event.announceOnApproval}
							/>
							Post an announcement note when the event is published
						</label>
						<Button type="submit">Submit for review</Button>
					</Form>
				</section>
			)}

			{data.debriefForm && !debrief.value?.success && (
				<section
					class="bg-white rounded-lg shadow-sm p-6"
					data-testid="event-debrief"
				>
					<h3 class="text-lg font-semibold mb-1">{data.debriefForm.title}</h3>
					{data.debriefForm.description && (
						<p class="text-sm text-gray-500 mb-4">
							{data.debriefForm.description}
						</p>
					)}
					{debriefFailed?.message && (
						<p class="mb-4 text-sm text-red-700" role="alert">
							{debriefFailed.message}
						</p>
					)}
					<Form action={debrief} class="space-y-5">
						<FormRenderer
							questions={data.debriefForm.questions}
							errors={
								debriefFailed?.fieldErrors as Record<string, string> | undefined
							}
						/>
						<Button type="submit">Submit debrief</Button>
					</Form>
				</section>
			)}
			{debrief.value?.success && (
				<output class="block text-sm text-green-700">
					Thank you: the debrief was saved.
				</output>
			)}

			<section
				class="bg-white rounded-lg shadow-sm p-6"
				data-testid="event-form-results"
			>
				<h3 class="text-lg font-semibold mb-3">Proposal and debrief</h3>
				{data.results.length === 0 ? (
					<p class="text-sm text-gray-400">No answers yet.</p>
				) : (
					<div class="space-y-6">
						{data.results.map((r) => (
							<div key={r.id} data-purpose={r.purpose ?? ""}>
								<p class="font-medium">{r.formTitle}</p>
								<p class="text-xs text-gray-500 mb-2">
									{r.authorName ?? "Unknown"} ·{" "}
									{new Date(r.createdAt).toLocaleString("en-GB")}
								</p>
								<dl class="grid gap-2 text-sm">
									{r.rows.map((row) => (
										<div key={row.name}>
											<dt class="font-medium text-gray-700">{row.question}</dt>
											<dd class="text-gray-600 whitespace-pre-wrap">
												{row.answer}
											</dd>
										</div>
									))}
								</dl>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
});
