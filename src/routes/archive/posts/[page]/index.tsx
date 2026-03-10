import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$ } from "@builder.io/qwik-city";
import { ListCard } from "~/components/page-blocks/ListCard";
import { postsService } from "~/services/posts.service";
import { formatPostDate, toPlainText } from "~/utils/posts";

const POSTS_PER_PAGE = 10;

export const useArchivePostsPage = routeLoader$(async ({ params, status }) => {
  const parsedPage = Number.parseInt(params.page ?? "", 10);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    status(404);
    return null;
  }

  const result = await postsService.getPage(parsedPage, POSTS_PER_PAGE);

  if (parsedPage >= result.totalPages) {
    status(404);
    return null;
  }

  return {
    page: parsedPage,
    items: result.items,
    totalPages: result.totalPages,
  };
});

export default component$(() => {
  const archivePage = useArchivePostsPage();

  if (!archivePage.value) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Archive Page Not Found</h1>
        <p class="text-gray-600 mb-8">
          The archive page you are looking for does not exist.
        </p>
        <Link href="/archive/posts" class="text-blue-600 hover:text-blue-800 font-medium">
          Go to archive start
        </Link>
      </div>
    );
  }

  const { page, items, totalPages } = archivePage.value;
  const hasPrevious = page > 0;
  const hasNext = page + 1 < totalPages;
  const previousHref = page === 1 ? "/archive/posts" : `/archive/posts/${page - 1}`;

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
          {hasPrevious ? (
            <Link
              href={previousHref}
              class="px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-900 hover:bg-gray-50"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}

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
