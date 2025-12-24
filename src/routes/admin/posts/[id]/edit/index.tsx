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
import { KoenigEditor } from "~/components/editor";
import { deletePost, getPostById, updatePost } from "~/services/posts.service";
import { updatePostSchema } from "~/db/schemas/posts";

export const usePost = routeLoader$(async (event) => {
  const postId = event.params.id;
  const post = await getPostById(postId);

  if (!post) {
    throw event.redirect(303, "/admin/posts");
  }

  return post;
});

export const useUpdatePost = routeAction$(
  async (data, event) => {
    const postId = event.params.id;

    const result = await updatePost(
      postId,
      {
        title: data.title,
        content: data.content || "",
        editorState: data.editorState || null,
        category: data.category || "",
      },
      event,
    );

    if (result?.error) {
      return {
        success: false,
        error: result?.error,
      };
    }

    return {
      success: true,
    };
  },
  { ...updatePostSchema },
);

export const useDeletePost = routeAction$(async (data, event) => {
  const postId = event.params.id;
  await deletePost(postId, event);
  throw event.redirect(303, "/admin/posts");
});

export default component$(() => {
  const post = usePost();
  const updatePostAction = useUpdatePost();
  const deletePostAction = useDeletePost();
  const isSubmitting = useSignal(false);
  const content = useSignal(post.value.content || "");
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
              <KoenigEditor
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

          <div class="flex justify-between">
            <div class="flex gap-4">
              <Button type="submit" disabled={isSubmitting.value}>
                {isSubmitting.value ? "Saving..." : "Save Changes"}
              </Button>
              <a href="/admin/posts">
                <Button variant="secondary">Cancel</Button>
              </a>
            </div>

            <Form action={deletePostAction}>
              <Button
                type="submit"
                variant="secondary"
                class="text-red-600 hover:bg-red-50"
                onClick$={(e) => {
                  if (!confirm("Are you sure you want to delete this post?")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete Post
              </Button>
            </Form>
          </div>
        </Form>
      </div>
    </div>
  );
});
