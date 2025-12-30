import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { BlockNoteEditor } from "~/components/editor";
import { postsService } from "~/services/posts.service";

const updateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  editorState: z.string().optional(),
});

export const usePost = routeLoader$(async (event) => {
  const postId = event.params.id;
  const post = await postsService.getById(postId);

  if (!post) {
    throw event.redirect(303, "/admin/posts");
  }

  return post;
});

export const useUpdatePost = routeAction$(async (data, event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  await requireAdmin(event);

  const postId = event.params.id;

  try {
    const updated = await postsService.update(postId, {
      title: data.title,
      editorState: data.editorState || null,
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
  const post = usePost();
  const updatePostAction = useUpdatePost();
  const isSubmitting = useSignal(false);
  const content = useSignal(post.value.body || "");
  const editorState = useSignal(post.value.editorState || null);

  const handleEditorChange$ = $((htmlContent: string, state: string) => {
    content.value = htmlContent;
    editorState.value = state;
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Post</h2>
        <a href="/admin/posts">
          <Button variant="secondary">Back to Posts</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={updatePostAction} class="space-y-6">
          <Input
            name="title"
            label="Title"
            value={post.value.title}
            placeholder="Enter post title"
            required
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <BlockNoteEditor
                editorState={post.value.editorState}
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
            <a href="/admin/posts">
              <Button variant="secondary">Cancel</Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
