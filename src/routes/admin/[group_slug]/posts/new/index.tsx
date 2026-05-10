import { component$, useSignal, $ } from "@qwik.dev/core";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { BlockNoteEditor } from "~/components/editor";
import { ImageUpload } from "~/components/ui/ImageUpload";
import { VisibilitySelector } from "~/components/admin/VisibilitySelector";
import { postsService } from "~/services/posts.service";
import { groupsService } from "~/services/groups.service";
import { getCurrentUserData } from "~/utils/server-auth";

export const useGroupContext = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;
  
  if (groupSlug === "global") {
    return { isGlobal: true, group: null };
  }
  
  const group = await groupsService.getBySlug(groupSlug);
  return { isGlobal: false, group };
});

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  editorState: z.string().optional(),
  featuredImage: z.string().optional(),
  visibility: z.enum(["global", "group-only"]).optional(),
});

export const useCreatePost = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const groupSlug = event.params.group_slug;
  let groupId: string | null = null;

  // Get group ID if not in global context
  if (groupSlug !== "global") {
    const group = await groupsService.getBySlug(groupSlug);
    if (!group) {
      return { success: false, error: "Group not found" };
    }
    groupId = group.id;
  }

  try {
    await postsService.create({
      title: data.title,
      editorState: data.editorState || null,
      featuredImage: data.featuredImage || null,
      userId: user.id,
      groupId: groupId,
      visibility: data.visibility || "global",
    } as any);

    throw event.redirect(303, `/admin/${groupSlug}/posts`);
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

  const handleEditorChange$ = $((htmlContent: string, state: string) => {
    content.value = htmlContent;
    editorState.value = state;
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Post</h2>
        <Button href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/posts`} variant="secondary">Back to Posts</Button>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={createPostAction} class="space-y-6">
          <Input
            name="title"
            label="Title"
            placeholder="Enter post title"
            required
          />

          <ImageUpload
            name="featuredImage"
            label="Featured Image (optional)"
            uploadPath="public/posts/"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
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

          {!groupContext.value.isGlobal && (
            <VisibilitySelector
              name="visibility"
              value="global"
              isGroupContext={true}
            />
          )}

          {createPostAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createPostAction.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Creating..." : "Create Post"}
            </Button>
            <Button href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/posts`} variant="secondary">Cancel</Button>
          </div>
        </Form>
      </div>
    </div>
  );
});
