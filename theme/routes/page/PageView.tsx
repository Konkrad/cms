import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";
import { BlockRenderer } from "~/components/builder/BlockRenderer";
import type { PageViewData } from "~/contracts/page";

/** Themed view for the catch-all CMS page route (`/[...slug]`). */
export const PageView = component$<{ page: PageViewData }>(({ page }) => {
  if (!page) {
    return (
      <div class="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Page Not Found</h1>
        <p class="text-gray-600 mb-8">
          The page you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/" class="text-blue-600 hover:text-blue-800 font-medium">
          Go back home
        </Link>
      </div>
    );
  }

  return (
    <div class="min-h-screen">
      {page.content && page.content.length > 0 ? (
        <div>
          {page.content
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
        </div>
      ) : (
        <div class="max-w-4xl mx-auto px-4 py-16">
          <h1 class="text-4xl font-bold text-gray-900 mb-4">{page.menuItem?.title}</h1>
          <p class="text-gray-600">This page is empty. Add content in the page builder.</p>
        </div>
      )}
    </div>
  );
});
