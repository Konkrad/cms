import {
  component$,
  useSignal,
  useVisibleTask$,
  useOnWindow,
  $,
} from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { PostWithUser } from "~/services/posts.service";
import { CursorPager } from "~/components/ui/CursorPager";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
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
  direction?: "forward" | "backward";
}) {
  const { postsService } = await import("~/services/posts.service");
  const { getServerSession } = await import("~/utils/server-auth");
  const { formatUser } = await import("~/utils/users");

  const session = await getServerSession(this as any);
  const res = await postsService.getAll(
    options.limit,
    options.cursor ?? null,
    options.direction ?? "forward",
  );

  const items = res.items.map((post) => ({
    ...post,
    featuredImage: publicImageUrlFromKey(post.featuredImage),
    user: post.user ? formatUser(post.user, !!session) : post.user,
  }));

  return { items, nextCursor: res.nextCursor, prevCursor: res.prevCursor };
});

export default component$<PostsListBlockProps>((props) => {
  const items = useSignal<PostWithUser[]>([]);
  const nextCursor = useSignal<string | null>(null);
  const prevCursor = useSignal<string | null>(null);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  const pageSize = props.limit ?? 10;

  // Client-only initial load — avoids serializing large post bodies into Qwik SSR
  // state. Runs on every mount, including a remount after a full route navigation
  // away and back. Cursors encode absolute DB sort-key coordinates, so a single
  // query in either direction reproduces the adjacent page directly.
  const loadFromUrl = $(async () => {
    const url = new URL(window.location.href);
    const cursorParam = url.searchParams.get("cursor");
    const direction = url.searchParams.get("dir") === "prev" ? "backward" : "forward";
    try {
      const result = await fetchPosts({
        limit: pageSize,
        cursor: cursorParam,
        direction: cursorParam ? direction : "forward",
      });
      items.value = result.items;
      nextCursor.value = result.nextCursor;
      prevCursor.value = result.prevCursor;
    } catch (e) {
      if (cursorParam) {
        // Invalid or expired cursor — fall back to page 1.
        url.searchParams.delete("cursor");
        url.searchParams.delete("dir");
        window.history.replaceState({}, "", url);
        try {
          const result = await fetchPosts({ limit: pageSize });
          items.value = result.items;
          nextCursor.value = result.nextCursor;
          prevCursor.value = result.prevCursor;
          return;
        } catch (e2) {
          error.value = e2 instanceof Error ? e2.message : "Failed to load posts";
          return;
        }
      }
      error.value = e instanceof Error ? e.message : "Failed to load posts";
    } finally {
      isLoading.value = false;
    }
  });

  useVisibleTask$(
    async () => {
      await loadFromUrl();
    },
    { strategy: "document-ready" },
  );

  const goNext = $(async () => {
    const cursor = nextCursor.value;
    if (!cursor) return;
    isLoading.value = true;
    try {
      const result = await fetchPosts({ limit: pageSize, cursor, direction: "forward" });
      items.value = result.items;
      nextCursor.value = result.nextCursor;
      prevCursor.value = result.prevCursor;
      const url = new URL(window.location.href);
      url.searchParams.set("cursor", cursor);
      url.searchParams.delete("dir");
      window.history.pushState({}, "", url);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load posts";
    } finally {
      isLoading.value = false;
    }
  });

  const goPrev = $(async () => {
    const cursor = prevCursor.value;
    if (!cursor) return;
    isLoading.value = true;
    try {
      const result = await fetchPosts({ limit: pageSize, cursor, direction: "backward" });
      items.value = result.items;
      nextCursor.value = result.nextCursor;
      prevCursor.value = result.prevCursor;
      const url = new URL(window.location.href);
      if (result.prevCursor === null) {
        // Landed back on the true first page — keep the URL canonical.
        url.searchParams.delete("cursor");
        url.searchParams.delete("dir");
      } else {
        url.searchParams.set("cursor", cursor);
        url.searchParams.set("dir", "prev");
      }
      window.history.pushState({}, "", url);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load posts";
    } finally {
      isLoading.value = false;
    }
  });

  // Browser back/forward: re-derive the displayed page from the URL.
  useOnWindow(
    "popstate",
    $(() => {
      void loadFromUrl();
    }),
  );

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value && items.value.length === 0 ? (
        <div class="text-center py-12">
          <p class="text-text-muted">Loading posts...</p>
        </div>
      ) : error.value ? (
        <p class="text-error text-center py-8">
          Failed to load posts: {error.value}
        </p>
      ) : items.value.length === 0 ? (
        <p class="text-text-muted text-center py-8">No posts found.</p>
      ) : (
        <>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.value.map((post) => (
              <ContentCard
                key={post.id}
                title={post.title}
                image={post.featuredImage ?? undefined}
                date={new Intl.DateTimeFormat("en-US", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(post.createdAt))}
                description={post.body.replace(/<[^>]+>/g, "").substring(0, 160)}
                href={`/posts/${post.id}`}
                label="Read More"
              />
            ))}
          </div>

          <CursorPager
            hasPrevious={prevCursor.value !== null}
            hasNext={nextCursor.value !== null}
            isLoading={isLoading.value}
            onPrevious$={goPrev}
            onNext$={goNext}
          />
        </>
      )}
    </div>
  );
});
