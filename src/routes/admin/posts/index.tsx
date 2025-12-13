import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { supabase } from '~/db/connection';
import { format } from 'date-fns';

export const usePosts = routeLoader$(async () => {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      users (display_name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
});

export const useDeletePost = routeAction$(
  async (data) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', data.postId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  },
  zod$({
    postId: z.string(),
  })
);

export default component$(() => {
  const posts = usePosts();
  const deletePostAction = useDeletePost();

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Posts</h2>
        <a href="/posts/new">
          <Button variant="primary">Create New Post</Button>
        </a>
      </div>

      {deletePostAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Post deleted successfully
        </div>
      )}

      {deletePostAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {deletePostAction.value.error}
        </div>
      )}

      <Card>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Author
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {posts.value.map((post) => (
                <tr key={post.id}>
                  <td class="px-6 py-4">
                    <div class="max-w-xs truncate">{post.title}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {post.users?.display_name || 'Unknown'}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(post.created_at), 'MMM d, yyyy')}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex gap-2">
                      <a
                        href={`/posts/${post.id}`}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </a>
                      <a
                        href={`/posts/${post.id}/edit`}
                        class="text-green-600 hover:text-green-900"
                      >
                        Edit
                      </a>
                      <Form action={deletePostAction} class="inline">
                        <input type="hidden" name="postId" value={post.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (!confirm('Are you sure you want to delete this post?')) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
});
