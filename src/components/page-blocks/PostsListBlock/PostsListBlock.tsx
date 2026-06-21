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
  // cursors[0] = null (page 1), cursors[N-1] = cursor for page N
  const cursors = useSignal<(string | null)[]>([null]);
  const currentPage = useSignal(1);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  const pageSize = props.limit ?? 10;

  // Client-only initial load — avoids serializing large post bodies into Qwik SSR state.
  // Runs on every mount, including a remount after a full route navigation away and
  // back (e.g. clicking into an article then hitting browser back) — the in-memory
  // cursor chain from the old instance is gone, so if the URL names a page beyond 1
  // we replay fetches in order to rebuild the chain and land back on that page,
  // rather than silently falling back to page 1.
  useVisibleTask$(
    async () => {
      try {
        const requestedPage = (() => {
          const param = new URL(window.location.href).searchParams.get("page");
          const n = param ? parseInt(param, 10) : 1;
          return Number.isFinite(n) && n > 1 ? n : 1;
        })();

        let result = await fetchPosts({ limit: pageSize });
        items.value = result.items;
        const newCursors: (string | null)[] = [null];
        if (result.nextCursor) newCursors.push(result.nextCursor);

        let landedPage = 1;
        for (let p = 2; p <= requestedPage && newCursors[p - 1]; p++) {
          result = await fetchPosts({ limit: pageSize, cursor: newCursors[p - 1] });
          items.value = result.items;
          landedPage = p;
          if (result.nextCursor) newCursors.push(result.nextCursor);
        }
        cursors.value = newCursors;
        currentPage.value = landedPage;

        // Fewer pages exist now than the URL claims — bring the URL back in sync.
        if (landedPage !== requestedPage) {
          const url = new URL(window.location.href);
          if (landedPage <= 1) url.searchParams.delete("page");
          else url.searchParams.set("page", String(landedPage));
          window.history.replaceState({ page: landedPage }, "", url);
        }
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to load posts";
      } finally {
        isLoading.value = false;
      }
    },
    { strategy: "document-ready" },
  );

  // Fetch and render a page we already have a cursor for (no URL side effects).
  const loadPage = $(async (page: number) => {
    if (page === currentPage.value) return;
    isLoading.value = true;
    try {
      const result = await fetchPosts({
        limit: pageSize,
        cursor: cursors.value[page - 1] ?? null,
      });
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

  // User clicked a page: load it and push a history entry so the URL reflects
  // the page and the browser back button returns to the previous page.
  const goToPage = $(async (page: number) => {
    if (page === currentPage.value) return;
    await loadPage(page);
    const url = new URL(window.location.href);
    if (page <= 1) url.searchParams.delete("page");
    else url.searchParams.set("page", String(page));
    window.history.pushState({ page }, "", url);
  });

  // Browser back/forward: re-render the page named in the URL using the cursor
  // we already walked to in this session.
  useOnWindow(
    "popstate",
    $(() => {
      const param = new URL(window.location.href).searchParams.get("page");
      const page = param ? Math.max(1, parseInt(param, 10) || 1) : 1;
      if (page !== currentPage.value && page <= cursors.value.length) {
        void loadPage(page);
      }
    }),
  );

  const totalKnownPages = cursors.value.length;

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
            totalKnownPages={totalKnownPages}
            isLoading={isLoading.value}
            onPageChange$={goToPage}
          />
        </div>
      )}
    </div>
  );
});
