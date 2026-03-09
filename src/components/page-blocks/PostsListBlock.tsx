import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { server$, type RequestEventCommon } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import type { PostWithUser } from "~/services/posts.service";
import { BlogCard } from "./BlogCard";

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
      label: "Number of Posts",
      type: "number",
      defaultValue: 6,
    },
  ],
  defaultData: {
    limit: 6,
  },
};

const fetchPosts = server$(async function (
  this: RequestEventCommon,
  options: { limit: number },
) {
  const { postsService } = await import("~/services/posts.service");
  const { getServerSession } = await import("~/utils/server-auth");
  const { formatUser } = await import("~/utils/users");

  const session = await getServerSession(this);
  const res = await postsService.getAll(options.limit);

  const items = res.items.map((post) => ({
    ...post,
    user: post.user ? formatUser(post.user, !!session) : post.user,
  }));

  return { items, isLoggedIn: !!session };
});

export default component$<PostsListBlockProps>((props) => {
  const posts = useSignal<PostWithUser[]>([]);
  const isLoggedIn = useSignal(false);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      const result = await fetchPosts({
        limit: props.limit ?? 6,
      });
      posts.value = result.items;
      isLoggedIn.value = result.isLoggedIn;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load posts";
    } finally {
      isLoading.value = false;
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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.value.map((post) => (
            <BlogCard
              key={post.id}
              date={post.createdAt}
              description={post.body}
              title={post.title}
              image={post.featuredImage ?? undefined}
              readMoreHref={`/posts/${post.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});
