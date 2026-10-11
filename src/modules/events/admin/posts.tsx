import { component$ } from "@qwik.dev/core";
import { Form, routeAction$, z, zod$ } from "@qwik.dev/router";
import { PostInputError, postFormSchema, posts } from "~/core";
import {
	Card,
	PostForm,
	type PostFormResult,
	VISIBILITY_LABELS,
} from "~/core/ui";
import { requireAdminEvent } from "./event-guards";
import type { AdminEventPostsData } from "./posts-data";

/**
 * An event's Posts tab: organisers write the announcement, updates ("Doors open at 18:00", no
 * title = a note) and the recap (a titled article) as core posts about the event (spec 5.2).
 * They show under the event on its page, and in post listings.
 */
export const useCreateEventPost = routeAction$(
	async (data, requestEvent): Promise<PostFormResult> => {
		const { user, event } = await requireAdminEvent(requestEvent);
		try {
			// The post belongs to the event's scope and is about the event; the subject field of
			// the generic form is ignored.
			await posts.create({
				scopeId: event.scopeId,
				subjectType: "events:event",
				subjectId: event.id,
				title: data.title,
				body: data.body,
				visibility: data.visibility,
				authorId: user.id,
			});
		} catch (error) {
			if (error instanceof PostInputError)
				return { success: false, error: error.message };
			throw error;
		}
		return { success: true };
	},
	zod$(postFormSchema),
);

export const useDeleteEventPost = routeAction$(
	async (data, requestEvent) => {
		const { event } = await requireAdminEvent(requestEvent);
		// Only posts about this event (an id of another post is ignored).
		const deleted = await posts.delete(data.postId, {
			subjectType: "events:event",
			subjectId: event.id,
		});
		return { success: deleted };
	},
	zod$({ postId: z.string().min(1) }),
);

export const AdminEventPosts = component$<{ data: AdminEventPostsData }>(
	({ data }) => {
		const createPost = useCreateEventPost();
		const deletePost = useDeleteEventPost();
		return (
			<div class="space-y-6">
				<Card>
					<h2 class="text-lg font-semibold text-gray-900 mb-1">
						Write a post about this event
					</h2>
					<p class="text-sm text-gray-500 mb-4">
						Posts appear under the event on{" "}
						<a href={data.event.url} class="text-blue-600 hover:underline">
							its page
						</a>{" "}
						and in post listings.
					</p>
					{/* Re-created after each new post, so the editor starts empty again. */}
					<PostForm
						key={`post-form-${data.posts.length}`}
						action={createPost}
						visibilities={data.visibilities}
						submitLabel="Publish post"
					/>
				</Card>

				<Card>
					<h2 class="text-lg font-semibold text-gray-900 mb-4">
						Posts about this event
					</h2>
					{data.posts.length === 0 ? (
						<p class="text-sm text-gray-500">No posts yet.</p>
					) : (
						<ul
							class="divide-y divide-gray-200"
							data-testid="event-admin-posts"
						>
							{data.posts.map((post) => (
								<li
									key={post.id}
									class="py-3 flex items-start justify-between gap-4"
								>
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900">
											{post.title ?? <span class="italic">Note</span>}
										</p>
										<p class="text-sm text-gray-500 line-clamp-2">
											{post.excerpt}
										</p>
										<p class="text-xs text-gray-400 mt-1">
											{post.authorName} ·{" "}
											{VISIBILITY_LABELS[post.visibility].label}
											{post.publishedAt
												? ` · ${new Date(post.publishedAt).toLocaleDateString("en-GB")}`
												: ""}
										</p>
									</div>
									<Form action={deletePost}>
										<input type="hidden" name="postId" value={post.id} />
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
