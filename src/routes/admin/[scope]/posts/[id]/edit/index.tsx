import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { PostForm, type PostFormResult } from "~/core/admin/PostForm/PostForm";
import { postFormSchema, subjectFromField } from "~/core/content/post-form";
import { PostInputError } from "~/core/content/posts";
import { postsService } from "~/core/content/posts.service";
import { refHref } from "~/core/refs/refs";
import { describeRef } from "~/core/registry/refs";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	isWithinScope,
	requireScopeRole,
} from "~/core/scopes/access";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";

export const usePost = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const post = await postsService.getById(event.params.id);
	if (!post) throw event.redirect(303, adminUrl(scope.path, "/posts"));
	if (!(await isWithinScope(scope, post.scopeId)))
		throw event.error(403, "Forbidden");

	const subjectRef =
		post.subjectType && post.subjectId
			? `${post.subjectType}:${post.subjectId}`
			: null;
	const subject = subjectRef ? await describeRef(subjectRef) : null;
	// The current visibility stays selectable (unchanged values are not re-checked).
	const allowed = await allowedVisibilities(user, post.scopeId);
	return assertNoPrivateFields({
		base: adminUrl(scope.path),
		visibilities: [...new Set([post.visibility, ...allowed])],
		post: {
			id: post.id,
			title: post.title,
			body: post.body,
			visibility: post.visibility,
			subject: subjectRef
				? {
						href: refHref(subjectRef),
						label: subject?.title ?? `${subjectRef} (unavailable)`,
					}
				: null,
		},
	});
});

export const useUpdatePost = routeAction$(
	async (data, event): Promise<PostFormResult> => {
		const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
		const target = await postsService.getById(event.params.id);
		if (!target) return { success: false, error: "Post not found" };
		if (!(await isWithinScope(scope, target.scopeId)))
			throw event.error(403, "Forbidden");
		try {
			await postsService.update(
				target.id,
				{
					title: data.title ?? null,
					body: data.body,
					visibility: data.visibility,
					...subjectFromField(data.subject),
				},
				user.id,
			);
		} catch (error) {
			if (error instanceof PostInputError)
				return { success: false, error: error.message };
			throw error;
		}
		return { success: true };
	},
	zod$(postFormSchema),
);

export default component$(() => {
	const data = usePost();
	const updatePost = useUpdatePost();
	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Edit post</h2>
				<Button href={`${data.value.base}/posts`} variant="secondary">
					Back to Posts
				</Button>
			</div>
			<div class="bg-white rounded-lg shadow-sm p-6">
				<PostForm
					action={updatePost}
					visibilities={data.value.visibilities}
					values={data.value.post}
					subjectPicker
					submitLabel="Save Changes"
					cancelHref={`${data.value.base}/posts`}
					successMessage="Post updated successfully!"
				/>
			</div>
		</div>
	);
});
