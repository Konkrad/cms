import { component$, useSignal } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { deletePost, getPostById, updatePost } from "~/services/posts.service";

export const usePost = routeLoader$(async (event) => {
  const postId = event.params.id;
  const post = await getPostById(postId);

  if (!post) {
    throw event.redirect(303, "/admin/posts");
  }

  return post;
});

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  excerpt: z.string().min(1, "Excerpt is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  image_url: z.string().optional(),
});

export const useUpdatePost = routeAction$(async (data, event) => {
  const postId = event.params.id;

  const result = await updatePost(
    postId,
    {
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category,
      image_url: data.image_url || null,
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
}, zod$(postSchema));

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

          <Input
            name="excerpt"
            label="Excerpt"
            value={post.value.excerpt}
            placeholder="Brief summary of the post"
            required
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <Select name="category" value={post.value.category} required>
              <option value="">Select a category</option>
              <option value="Announcements">Announcements</option>
              <option value="Events">Events</option>
              <option value="Community">Community</option>
              <option value="Resources">Resources</option>
              <option value="News">News</option>
            </Select>
          </div>

          <Input
            name="image_url"
            label="Image URL (optional)"
            value={post.value.image_url || ""}
            placeholder="https://example.com/image.jpg"
          />

          <TextArea
            name="content"
            label="Content"
            value={post.value.content}
            placeholder="Write your post content here..."
            rows={12}
            required
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
