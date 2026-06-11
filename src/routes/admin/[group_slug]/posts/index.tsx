import { component$ } from "@qwik.dev/core";
import { Form, routeLoader$, routeAction$, Link } from "@qwik.dev/router";
import { format } from "date-fns";
import { Button } from "~/components/ui/Button";
import { groupsService } from "~/services/groups.service";
import { db } from "~/db/connection";
import { posts } from "~/db/schemas/posts";
import { users as usersTable } from "~/db/schemas/users";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { postsService } from "~/services/posts.service";
import { requireGroupAdmin } from "~/utils/access-control";
import { Pagination, PAGE_SIZE } from "~/components/admin/Pagination/Pagination";
import { SearchBar } from "~/components/admin/SearchBar/SearchBar";

export const usePosts = routeLoader$(async ({ params, url }) => {
  const groupSlug = params.group_slug;
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const group =
    groupSlug !== "global" ? await groupsService.getBySlug(groupSlug) : null;

  const where = and(
    isNull(posts.deletedAt),
    group ? eq(posts.groupId, group.id) : undefined,
    search
      ? or(like(posts.title, `%${search}%`))
      : undefined,
  );

  const [countRows, rawItems] = await Promise.all([
    db.select({ total: sql<number>`COUNT(*)` }).from(posts).where(where),
    db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        createdAt: posts.createdAt,
        userName: usersTable.name,
        userFamilyName: usersTable.familyName,
      })
      .from(posts)
      .leftJoin(usersTable, eq(posts.userId, usersTable.id))
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  const items = rawItems.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
    user: { name: r.userName ?? "", familyName: r.userFamilyName ?? "" },
  }));

  return { posts: items, total, page, pageSize: PAGE_SIZE, search, groupSlug };
});

export const useDeletePost = routeAction$(async (data, event) => {
  await requireGroupAdmin(event);
  await postsService.delete(data.postId as string);
  return { success: true };
});

export default component$(() => {
  const data = usePosts();
  const deletePostAction = useDeletePost();
  const totalPages = Math.ceil(data.value.total / data.value.pageSize);

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">
          {data.value.groupSlug === "global" ? "All Posts" : "Group Posts"}
        </h2>
        <Button href={`/admin/${data.value.groupSlug}/posts/new`}>
          Create New Post
        </Button>
      </div>

      <SearchBar value={data.value.search} placeholder="Search by title…" />

      <div class="bg-white rounded-lg shadow-sm overflow-x-auto">
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
                    {post.body.substring(0, 100)}…
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
                        preventdefault:click
                        class="text-red-600 hover:text-red-900"
                        onClick$={(e) => {
                          if (
                            !confirm(
                              "Are you sure you want to delete this post?",
                            )
                          )
                            return;
                          (e.target as HTMLElement)
                            .closest("form")
                            ?.requestSubmit();
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
            {data.value.search
              ? `No posts matching "${data.value.search}".`
              : "No posts found. Create your first post!"}
          </div>
        )}
        <Pagination
          page={data.value.page}
          totalPages={totalPages}
          total={data.value.total}
          pageSize={data.value.pageSize}
        />
      </div>
    </div>
  );
});
