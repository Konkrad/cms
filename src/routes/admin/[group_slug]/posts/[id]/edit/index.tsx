import { component$, useSignal, $ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { BlockNoteEditor } from "~/components/editor";
import { ImageUpload } from "~/components/ui/ImageUpload";
import { postsService } from "~/services/posts.service";

const updateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  editorState: z.string().optional(),
  featuredImage: z.string().optional(),
});

export const usePost = routeLoader$(async (event) => {
  const postId = event.params.id;
  const groupSlug = event.params.group_slug;
  const post = await postsService.getById(postId);

  if (!post) {
    throw event.redirect(303, `/admin/${groupSlug}/posts`);
  }

  return { post, groupSlug };
});

export const useUpdatePost = routeAction$(async (data, event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);

  const postId = event.params.id;

  try {
    const updated = await postsService.update(postId, {
      title: data.title,
      editorState: data.editorState || null,
      featuredImage: data.featuredImage || null,
    });

    if (!updated) {
      return {
        success: false,
        error: "Post not found",
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to update post",
    };
  }
}, zod$(updateSchema));

export default component$(() => {
  const data = usePost();
  const updatePostAction = useUpdatePost();
  const isSubmitting = useSignal(false);
  const content = useSignal(data.value.post.body || "");
  const editorState = useSignal(data.value.post.editorState || null);

  const handleEditorChange$ = $((htmlContent: string, state: string) => {
    content.value = htmlContent;
    editorState.value = state;
  });

  const handleSubmit = $(async (e: Event) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const pending: Record<string, () => Promise<string>> = (window as any).__deferredUploads ?? {};
    for (const [field, uploadFn] of Object.entries(pending)) {
      const url = await uploadFn();
      formData.set(field, url);
    }
    await updatePostAction.submit(formData);
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Post</h2>
        <Button href={`/admin/${data.value.groupSlug}/posts`} variant="secondary">Back to Posts</Button>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <form onSubmit$={handleSubmit} class="space-y-6">
          <Input
            name="title"
            label="Title"
            value={data.value.post.title}
            placeholder="Enter post title"
            required
          />

          <ImageUpload
            name="featuredImage"
            label="Featured Image (optional)"
            uploadPath="public/posts/"
            currentImageUrl={(data.value.post as any).featuredImage}
            deferred={true}
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <BlockNoteEditor
                editorState={data.value.post.editorState}
                content={data.value.post.body || ""}
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

          {updatePostAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {updatePostAction.value.error}
            </div>
          )}

          {updatePostAction.value?.success && (
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Post updated successfully!
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Saving..." : "Save Changes"}
            </Button>
            <Button href={`/admin/${data.value.groupSlug}/posts`} variant="secondary">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
});
