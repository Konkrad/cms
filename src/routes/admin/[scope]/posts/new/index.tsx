import { $, component$, useSignal } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Input } from "~/components/ui/Input";
import { VisibilitySelector } from "~/core/admin/VisibilitySelector";
import { BlockNoteEditor } from "~/core/content/editor";
import { postsService } from "~/core/content/posts.service";
import { adminUrl } from "~/core/router/scope-path";
import {
	ADMIN_ACCESS,
	allowedVisibilities,
	requireScopeRole,
} from "~/core/scopes/access";
import { VISIBILITIES } from "~/core/scopes/visibility";

export const useGroupContext = routeLoader$(async (event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	return {
		base: adminUrl(scope.path),
		visibilities: await allowedVisibilities(user, scope.id),
	};
});

const postSchema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string(),
	editorState: z.string().optional(),
	featuredImage: z.string().optional(),
	visibility: z.enum(VISIBILITIES),
});

export const useCreatePost = routeAction$(async (data, event) => {
	const { user, scope } = await requireScopeRole(event, ADMIN_ACCESS);
	const isRoot = scope.parentId === null;
	if (!(await allowedVisibilities(user, scope.id)).includes(data.visibility)) {
		return {
			success: false,
			error: "You cannot publish with this visibility",
		};
	}

	try {
		await postsService.create({
			title: data.title,
			editorState: data.editorState || null,
			featuredImage: data.featuredImage || null,
			userId: user.id,
			scopeId: scope.id,
			visibility: data.visibility,
		} as any);

		throw event.redirect(303, adminUrl(scope.path, "/posts"));
	} catch (error: any) {
		if (error.status === 303) throw error;
		return {
			success: false,
			error: error?.message || "Failed to create post",
		};
	}
}, zod$(postSchema));

export default component$(() => {
	const createPostAction = useCreatePost();
	const groupContext = useGroupContext();
	const isSubmitting = useSignal(false);
	const content = useSignal("");
	const editorState = useSignal<string | null>(null);
	const triggerUpload = useSignal(false);

	const handleEditorChange$ = $((htmlContent: string, state: string) => {
		content.value = htmlContent;
		editorState.value = state;
	});

	const handleSubmit = $(() => {
		isSubmitting.value = true;
		triggerUpload.value = true;
	});

	const onUploadDone = $(() => {
		const form = document.querySelector("form");
		if (form) createPostAction.submit(new FormData(form));
	});

	return (
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Create New Post</h2>
				<Button href={`${groupContext.value.base}/posts`} variant="secondary">
					Back to Posts
				</Button>
			</div>

			<div class="bg-white rounded-lg shadow-sm p-6">
				<form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
					<Input
						name="title"
						label="Title"
						placeholder="Enter post title"
						required
					/>

					<p class="text-sm font-medium text-gray-700 mb-1">
						Featured Image (optional)
					</p>
					<ImageUploader
						name="featuredImage"
						path="public/posts"
						aspectRatio="1/1"
						crop
						cropAspectRatio="1/1"
						triggerSignal={triggerUpload}
						onSettled$={onUploadDone}
					/>

					<div>
						<p class="block text-sm font-medium text-gray-700 mb-2">Content</p>
						<div class="border border-gray-300 rounded-lg overflow-hidden">
							<BlockNoteEditor
								editorState={null}
								onChange$={handleEditorChange$}
								uploadUrl="/api/images"
							/>
						</div>
					</div>

					<input type="hidden" name="content" value={content.value} />
					<input
						type="hidden"
						name="editorState"
						value={editorState.value || ""}
					/>

					<VisibilitySelector
						name="visibility"
						value={groupContext.value.visibilities[0]}
						options={groupContext.value.visibilities}
					/>

					{createPostAction.value?.error && (
						<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
							{createPostAction.value.error}
						</div>
					)}

					<div class="flex gap-4">
						<Button type="submit" disabled={isSubmitting.value}>
							{isSubmitting.value ? "Creating..." : "Create Post"}
						</Button>
						<Button
							href={`${groupContext.value.base}/posts`}
							variant="secondary"
						>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
});
