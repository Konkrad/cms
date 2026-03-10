import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import { ListCard } from "~/components/page-blocks/ListCard";
import { postsService } from "~/services/posts.service";
import { formatPostDate, toPlainText } from "~/utils/posts";

const POSTS_PER_PAGE = 10;

export const useArchivePostsPage = routeLoader$(async () => {
  const page = 0;
  const result = await postsService.getPage(page, POSTS_PER_PAGE);

  return {
    page,
    items: result.items,
    totalPages: result.totalPages,
  };
});

export default component$(() => {
  const archivePage = useArchivePostsPage();
  const { page, items, totalPages } = archivePage.value;
  const hasNext = page + 1 < totalPages;

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      <div class="mb-8">
        <h1 class="font-['Rubik',sans-serif] font-semibold text-[36px] md:text-[44px] leading-[1.1] text-gray-900">
          Post Archive
        </h1>
      </div>

      {items.length === 0 ? (
        <p class="text-gray-500 text-center py-8">No posts found.</p>
      ) : (
        <div class="flex flex-col gap-6">
          {items.map((post) => (
            <ListCard
              key={post.id}
              title={post.title}
              image={post.featuredImage ?? undefined}
              date={formatPostDate(post.createdAt)}
              description={toPlainText(post.body).substring(0, 180)}
              readMoreHref={`/posts/${post.id}`}
              readMoreLabel="Read More"
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div class="mt-10 flex items-center justify-between gap-4">
          <span class="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
          {hasNext ? (
            <Link
              href={`/archive/posts/${page + 1}`}
              class="px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
});
