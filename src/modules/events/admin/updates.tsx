import { component$, useSignal } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import {
	articleFormSchema,
	articles,
	ContentInputError,
	noteFormSchema,
	notes,
} from "~/core";
import {
	ArticleForm,
	Button,
	Card,
	type ContentFormResult,
	formatDate,
	NoteForm,
	VISIBILITY_LABELS,
} from "~/core/ui";
import { requireAdminEvent } from "./event-guards";
import type { AdminEventUpdatesData } from "./updates-data";

/**
 * An event's Updates tab (spec 5.2): organisers write notes ("Doors open at 18:00") and
 * articles (the announcement, the recap) about the event. Both are core content with the event
 * as subject: they show under the event on its page, and in the news listings.
 */

/** The event as the subject; the subject field of the generic forms is ignored. */
const aboutEvent = (id: string) => ({
	subjectType: "events:event",
	subjectId: id,
});

async function saved(
	write: () => Promise<{ inReview: boolean }>,
): Promise<ContentFormResult> {
	try {
		const { inReview } = await write();
		return { success: true, inReview };
	} catch (error) {
		if (error instanceof ContentInputError)
			return { success: false, error: error.message };
		throw error;
	}
}

export const useCreateEventNote = routeAction$(async (data, requestEvent) => {
	const { user, event } = await requireAdminEvent(requestEvent);
	return saved(() =>
		notes.create({
			scopeId: event.scopeId,
			...aboutEvent(event.id),
			body: data.body,
			visibility: data.visibility,
			authorId: user.id,
		}),
	);
}, zod$(noteFormSchema));

export const useCreateEventArticle = routeAction$(
	async (data, requestEvent) => {
		const { user, event } = await requireAdminEvent(requestEvent);
		return saved(() =>
			articles.create({
				scopeId: event.scopeId,
				...aboutEvent(event.id),
				title: data.title,
				featuredImage: data.featuredImage || null,
				body: data.body,
				visibility: data.visibility,
				authorId: user.id,
			}),
		);
	},
	zod$(articleFormSchema),
);

export const useDeleteEventUpdate = routeAction$(
	async (data, requestEvent) => {
		const { event } = await requireAdminEvent(requestEvent);
		// Only notes and articles about this event (an id of another item is ignored).
		const api = data.type === "note" ? notes : articles;
		return { success: await api.delete(data.id, aboutEvent(event.id)) };
	},
	zod$({ type: z.enum(["note", "article"]), id: z.string().min(1) }),
);

export const AdminEventUpdates = component$<{ data: AdminEventUpdatesData }>(
	({ data }) => {
		const createNote = useCreateEventNote();
		const createArticle = useCreateEventArticle();
		const deleteUpdate = useDeleteEventUpdate();
		const writing = useSignal<"note" | "article" | null>(null);
		const count = data.updates.length;
		return (
			<div class="space-y-6">
				<Card>
					<h2 class="text-lg font-semibold text-gray-900 mb-1">
						Updates about this event
					</h2>
					<p class="text-sm text-gray-500 mb-4">
						Notes and articles appear under the event on{" "}
						<a href={data.event.url} class="text-blue-600 hover:underline">
							its page
						</a>{" "}
						and in the news.
					</p>
					<div class="flex gap-3 mb-4">
						<Button
							type="button"
							variant={writing.value === "note" ? "primary" : "secondary"}
							onClick$={() => {
								writing.value = "note";
							}}
						>
							Write note
						</Button>
						<Button
							type="button"
							variant={writing.value === "article" ? "primary" : "secondary"}
							onClick$={() => {
								writing.value = "article";
							}}
						>
							Write article
						</Button>
					</div>
					{/* Re-created after each new item, so the editor starts empty again. */}
					{writing.value === "note" && (
						<NoteForm
							key={`note-${count}`}
							action={createNote}
							visibilities={data.visibilities}
							submitLabel="Publish note"
						/>
					)}
					{writing.value === "article" && (
						<ArticleForm
							key={`article-${count}`}
							action={createArticle}
							visibilities={data.visibilities}
							submitLabel="Publish article"
						/>
					)}
				</Card>

				<Card>
					{count === 0 ? (
						<p class="text-sm text-gray-500">No updates yet.</p>
					) : (
						<ul
							class="divide-y divide-gray-200"
							data-testid="event-admin-updates"
						>
							{data.updates.map((item) => (
								<li
									key={`${item.type}:${item.id}`}
									class="py-3 flex items-start justify-between gap-4"
								>
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900">
											{item.title ?? <span class="italic">Note</span>}
										</p>
										<p class="text-sm text-gray-500 line-clamp-2">
											{item.excerpt}
										</p>
										<p class="text-xs text-gray-400 mt-1">
											{item.authorName} ·{" "}
											{VISIBILITY_LABELS[item.visibility].label}
											{item.publishedAt
												? ` · ${formatDate(item.publishedAt)}`
												: item.reviewStatus === "rejected"
													? " · Not approved"
													: " · In review"}
										</p>
										{!item.publishedAt && item.reviewComment && (
											<p class="text-xs text-red-700 mt-1 whitespace-pre-wrap">
												“{item.reviewComment}”
											</p>
										)}
									</div>
									<Form action={deleteUpdate}>
										<input type="hidden" name="type" value={item.type} />
										<input type="hidden" name="id" value={item.id} />
										<button
											type="submit"
											class="text-sm text-red-600 hover:text-red-800"
										>
											Delete
										</button>
									</Form>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
		);
	},
);
