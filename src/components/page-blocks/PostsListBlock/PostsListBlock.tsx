import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { PostWithUser } from "~/services/posts.service";
import { CursorPager } from "~/components/ui/CursorPager";
import { ListCard } from "../ListCard/ListCard";
import { publicImageUrlFromKey } from "~/utils/images";

interface PostsListBlockProps {
  limit?: number;
}

export const definition: BlockDefinition = {
  name: "Posts List",
  componentType: "PostsListBlock",
  category: "dynamic",
  icon: "📰",
  configSchema: [
    {
      name: "limit",
      label: "Posts per page",
      type: "number",
      defaultValue: 10,
    },
  ],
  defaultData: {
    limit: 10,
  },
};

const fetchPosts = server$(async function (options: {
  limit: number;
  cursor?: string | null;
}) {
  const { postsService } = await import("~/services/posts.service");
  const { getServerSession } = await import("~/utils/server-auth");
  const { formatUser } = await import("~/utils/users");

  const session = await getServerSession(this as any);
  const res = await postsService.getAll(options.limit, options.cursor ?? null);

  const items = res.items.map((post) => ({
    ...post,
    featuredImage: publicImageUrlFromKey(post.featuredImage),
    user: post.user ? formatUser(post.user, !!session) : post.user,
  }));

  return { items, nextCursor: res.nextCursor ?? null };
});

export default component$<PostsListBlockProps>((props) => {
  const items = useSignal<PostWithUser[]>([]);
  // cursors[0] = null (page 1), cursors[1] = cursor for page 2, etc.
  const cursors = useSignal<(string | null)[]>([null]);
  const currentPage = useSignal(1);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  const pageSize = props.limit ?? 10;

  const goToPage = $(async (page: number) => {
    isLoading.value = true;
    try {
      const result = await fetchPosts({ limit: pageSize, cursor: cursors.value[page - 1] });
      items.value = result.items;
      currentPage.value = page;
      if (result.nextCursor && cursors.value.length <= page) {
        cursors.value = [...cursors.value, result.nextCursor];
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load posts";
    } finally {
      isLoading.value = false;
    }
  });

  useTask$(async () => {
    await goToPage(1);
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value && items.value.length === 0 ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading posts...</p>
        </div>
      ) : error.value ? (
        <p class="text-red-500 text-center py-8">
          Failed to load posts: {error.value}
        </p>
      ) : items.value.length === 0 ? (
        <p class="text-gray-500 text-center py-8">No posts found.</p>
      ) : (
        <div class="flex flex-col gap-6">
          {items.value.map((post) => (
            <ListCard
              key={post.id}
              title={post.title}
              image={post.featuredImage ?? undefined}
              date={new Intl.DateTimeFormat("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }).format(new Date(post.createdAt))}
              description={post.body.replace(/<[^>]+>/g, "").substring(0, 160)}
              readMoreHref={`/posts/${post.id}`}
              readMoreLabel="Read More"
            />
          ))}

          <CursorPager
            currentPage={currentPage.value}
            totalKnownPages={cursors.value.length}
            isLoading={isLoading.value}
            onPageChange$={goToPage}
          />
        </div>
      )}
    </div>
  );
});
