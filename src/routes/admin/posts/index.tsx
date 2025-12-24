import { component$ } from "@builder.io/qwik";
import { Form, routeLoader$, routeAction$ } from "@builder.io/qwik-city";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { postsService } from "~/services/posts.service";

export const usePosts = routeLoader$(async () => {
  const result = await postsService.getAll(100);
  return result.items;
});

export const useDeletePost = routeAction$(async (data, event) => {
  const postId = data.postId as string;
  await postsService.delete(postId);
  return { success: true };
});

export default component$(() => {
  const posts = usePosts();
  const deletePostAction = useDeletePost();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Posts</h2>
        <a href="/admin/posts/new">
          <Button>Create New Post</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Author
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Published
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {posts.value.map((post) => (
              <tr key={post.id} class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">
                    {post.title}
                  </div>
                  <div class="text-sm text-gray-500 line-clamp-1">
                    {post.body.substring(0, 100)}...
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {post.user.displayName}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(post.createdAt), "MMM d, yyyy")}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center gap-4">
                    <a
                      href={`/admin/posts/${post.id}/edit`}
                      class="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </a>
                    <Form action={deletePostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <button
                        type="submit"
                        class="text-red-600 hover:text-red-900"
                        onClick$={(e) => {
                          if (
                            !confirm(
                              "Are you sure you want to delete this post?",
                            )
                          ) {
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
        {posts.value.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No posts found. Create your first post!
          </div>
        )}
      </div>
    </div>
  );
});
