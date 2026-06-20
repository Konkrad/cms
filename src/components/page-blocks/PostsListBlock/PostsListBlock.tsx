import { component$, useSignal, useTask$, $ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { PostWithUser } from "~/services/posts.service";
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

  return { items, nextCursor: res.nextCursor ?? null, isLoggedIn: !!session };
});

export default component$<PostsListBlockProps>((props) => {
  const posts = useSignal<PostWithUser[]>([]);
  const nextCursor = useSignal<string | null>(null);
  const isLoggedIn = useSignal(false);
  const isLoading = useSignal(true);
  const isLoadingMore = useSignal(false);
  const error = useSignal<string | null>(null);

  const pageSize = props.limit ?? 10;

  useTask$(async () => {
    try {
      const result = await fetchPosts({ limit: pageSize });
      posts.value = result.items;
      nextCursor.value = result.nextCursor;
      isLoggedIn.value = result.isLoggedIn;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load posts";
    } finally {
      isLoading.value = false;
    }
  });

  const loadMore = $(async () => {
    if (!nextCursor.value || isLoadingMore.value) return;
    isLoadingMore.value = true;
    try {
      const result = await fetchPosts({ limit: pageSize, cursor: nextCursor.value });
      posts.value = [...posts.value, ...result.items];
      nextCursor.value = result.nextCursor;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load more posts";
    } finally {
      isLoadingMore.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading posts...</p>
        </div>
      ) : error.value ? (
        <p class="text-red-500 text-center py-8">
          Failed to load posts: {error.value}
        </p>
      ) : posts.value.length === 0 ? (
        <p class="text-gray-500 text-center py-8">No posts found.</p>
      ) : (
        <div class="flex flex-col gap-6">
          {posts.value.map((post) => (
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

          {nextCursor.value && (
            <div class="flex justify-center pt-4">
              <button
                class="px-6 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick$={loadMore}
                disabled={isLoadingMore.value}
              >
                {isLoadingMore.value ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
