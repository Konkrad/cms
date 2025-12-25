import { component$, useSignal, $ } from "@builder.io/qwik";
import { Form, routeAction$, z, zod$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { KoenigEditor } from "~/components/editor";
import { postsService } from "~/services/posts.service";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  editorState: z.string().optional(),
});

export const useCreatePost = routeAction$(async (data, event) => {
  const { requireAdmin } = await import("~/utils/server-auth");
  const user = await requireAdmin(event);

  try {
    await postsService.create({
      title: data.title,
      editorState: data.editorState || null,
      userId: user.id,
    });

    throw event.redirect(303, "/admin/posts");
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
  const isSubmitting = useSignal(false);
  const content = useSignal("");
  const editorState = useSignal<string | null>(null);

  const handleEditorChange$ = $((htmlContent: string, state: string) => {
    content.value = htmlContent;
    editorState.value = state;
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Post</h2>
        <a href="/admin/posts">
          <Button variant="secondary">Back to Posts</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={createPostAction} class="space-y-6">
          <Input
            name="title"
            label="Title"
            placeholder="Enter post title"
            required
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <KoenigEditor
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

          {createPostAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createPostAction.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Creating..." : "Create Post"}
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
