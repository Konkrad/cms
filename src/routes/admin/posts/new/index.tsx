import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { createPost } from '~/services/posts.service';
import { Input } from '~/components/ui/Input';
import { TextArea } from '~/components/ui/TextArea';
import { Button } from '~/components/ui/Button';
import { Select } from '~/components/ui/Select';

const postSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  excerpt: z.string().min(1, 'Excerpt is required'),
  content: z.string().min(1, 'Content is required'),
  category: z.string().min(1, 'Category is required'),
  image_url: z.string().optional(),
});

export const useCreatePost = routeAction$(async (data, event) => {
  const result = await createPost(
    {
      title: data.title,
      excerpt: data.excerpt,
      content: data.content,
      category: data.category,
      image_url: data.image_url || null,
    },
    event
  );

  if (result.error) {
    return {
      success: false,
      error: result.error,
    };
  }

  throw event.redirect(303, '/admin/posts');
}, zod$(postSchema));

export default component$(() => {
  const createPostAction = useCreatePost();
  const isSubmitting = useSignal(false);

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Post</h2>
        <a href="/admin/posts">
          <Button variant="secondary">
            Back to Posts
          </Button>
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

          <Input
            name="excerpt"
            label="Excerpt"
            placeholder="Brief summary of the post"
            required
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <Select name="category" required>
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
            placeholder="https://example.com/image.jpg"
          />

          <TextArea
            name="content"
            label="Content"
            placeholder="Write your post content here..."
            rows={12}
            required
          />

          {createPostAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createPostAction.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting.value}
            >
              {isSubmitting.value ? 'Creating...' : 'Create Post'}
            </Button>
            <a href="/admin/posts">
              <Button variant="secondary">
                Cancel
              </Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
