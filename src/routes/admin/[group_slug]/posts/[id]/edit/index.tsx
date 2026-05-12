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
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { postsService } from "~/services/posts.service";
import { publicImageUrlFromKey } from "~/utils/images";

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

  return {
    post,
    groupSlug,
    featuredImageUrl: publicImageUrlFromKey(post.featuredImage),
  };
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
  const triggerUpload = useSignal(false);
  const showFeaturedUploader = useSignal(!data.value.post.featuredImage);

  const handleEditorChange$ = $((htmlContent: string, state: string) => {
    content.value = htmlContent;
    editorState.value = state;
  });

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const onUploadDone = $(() => {
    const form = document.querySelector('form');
    if (form) updatePostAction.submit(new FormData(form));
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Post</h2>
        <Button href={`/admin/${data.value.groupSlug}/posts`} variant="secondary">Back to Posts</Button>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6">
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
          <Input
            name="title"
            label="Title"
            value={data.value.post.title}
            placeholder="Enter post title"
            required
          />

          <p class="text-sm font-medium text-gray-700 mb-1">Featured Image (optional)</p>
          {!showFeaturedUploader.value && data.value.post.featuredImage ? (
            <div class="relative rounded-sm border border-gray-200 overflow-hidden">
              <img src={data.value.featuredImageUrl || ""} alt="Current" class="w-full object-cover" style={{ aspectRatio: "1/1" }} />
              <button type="button" class="absolute bottom-2 right-2 rounded-sm bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-white" onClick$={() => { showFeaturedUploader.value = true; }}>Change image</button>
              <input type="hidden" name="featuredImage" value={data.value.post.featuredImage} />
            </div>
          ) : (
            <ImageUploader
              name="featuredImage"
              path="public/posts"
              aspectRatio="1/1"
              crop
              cropAspectRatio="1/1"
              triggerSignal={triggerUpload}
              onSettled$={onUploadDone}
            />
          )}

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
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              {updatePostAction.value.error}
            </div>
          )}

          {updatePostAction.value?.success && (
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-sm">
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
