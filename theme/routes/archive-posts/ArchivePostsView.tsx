import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { ListCard } from "~theme/blocks/ListCard";
import { formatPostDate, toPlainText } from "~/utils/posts";
import type { ArchivePostsViewData } from "~/contracts/archive-posts";

/** Themed view shared by `/archive/posts` and `/archive/posts/[page]`. */
export const ArchivePostsView = component$<{ data: ArchivePostsViewData }>(
  ({ data }) => {
    if (!data) {
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

    const { page, items, totalPages, previousHref, nextHref } = data;

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
            {previousHref ? (
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

            {nextHref ? (
              <Link
                href={nextHref}
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
  },
);
