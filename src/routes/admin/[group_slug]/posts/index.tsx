import { component$ } from "@qwik.dev/core";
import { Form, routeLoader$, routeAction$, Link } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { postsService } from "~/services/posts.service";
import { groupsService } from "~/services/groups.service";

export const usePosts = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;
  
  // Get all posts or group-specific posts
  const result = await postsService.getAll(1000);
  let filteredItems = result.items;
  
  // Filter by group if not global
  if (groupSlug !== "global") {
    const group = await groupsService.getBySlug(groupSlug);
    if (group) {
      filteredItems = result.items.filter((p) => p.groupId === group.id);
    }
  }
  
  return { posts: filteredItems, groupSlug };
});

export const useDeletePost = routeAction$(async (data, event) => {
  const postId = data.postId as string;
  await postsService.delete(postId);
  return { success: true };
});

export default component$(() => {
  const data = usePosts();
  const deletePostAction = useDeletePost();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          {data.value.groupSlug === "global" ? "All Posts" : "Group Posts"}
        </h2>
        <Button href={`/admin/${data.value.groupSlug}/posts/new`}>Create New Post</Button>
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
            {data.value.posts.map((post) => (
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
                    {post.user.name} {post.user.familyName}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(post.createdAt), "MMM d, yyyy")}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center gap-4">
                    <Link
                      href={`/admin/${data.value.groupSlug}/posts/${post.id}/edit`}
                      class="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </Link>
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
        {data.value.posts.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No posts found. Create your first post!
          </div>
        )}
      </div>
    </div>
  );
});
