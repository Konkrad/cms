import { component$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { PostForm, type PostFormResult } from "~/core/admin/PostForm/PostForm";
import { postFormSchema, subjectFromField } from "~/core/content/post-form";
import { PostInputError } from "~/core/content/posts";
import { postsService } from "~/core/content/posts.service";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	requireScopeRole,
} from "~/core/scopes/access";

export const usePostContext = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return {
		base: adminUrl(scope.path),
		visibilities: await allowedVisibilities(user, scope.id),
	};
});

export const useCreatePost = routeAction$(
	async (data, event): Promise<PostFormResult> => {
		const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
		try {
			// The scope comes from the admin URL; visibility and subject are checked by the service.
			await postsService.create({
				scopeId: scope.id,
				title: data.title,
				body: data.body,
				visibility: data.visibility,
				...subjectFromField(data.subject),
				authorId: user.id,
			});
		} catch (error) {
			if (error instanceof PostInputError)
				return { success: false, error: error.message };
			throw error;
		}
		throw event.redirect(303, adminUrl(scope.path, "/posts"));
	},
	zod$(postFormSchema),
);

export default component$(() => {
	const ctx = usePostContext();
	const createPost = useCreatePost();
	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">New post</h2>
				<Button href={`${ctx.value.base}/posts`} variant="secondary">
					Back to Posts
				</Button>
			</div>
			<div class="bg-white rounded-lg shadow-sm p-6">
				<PostForm
					action={createPost}
					visibilities={ctx.value.visibilities}
					subjectPicker
					submitLabel="Publish"
					cancelHref={`${ctx.value.base}/posts`}
				/>
			</div>
		</div>
	);
});
