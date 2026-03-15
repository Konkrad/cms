import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { BlockRenderer } from "~/components/builder/BlockRenderer";
import { pagesService } from "~/services/pages.service";

export const usePage = routeLoader$(async ({ params, status }) => {
  console.log("[Page route] usePage - starting with params:", params);
  // Normalize slug to match database format (with leading slash)
  const slug = params.slug ? `/${params.slug}` : "/";
  console.log("[Page route] usePage - resolved slug:", slug);

  const page = await pagesService.getBySlug(slug);
  console.log(
    "[Page route] usePage - fetched page summary:",
    page
      ? {
          id: (page as any).id ?? null,
          status: (page as any).status ?? null,
          title: (page as any).title ?? null,
        }
      : null,
  );

  if (!page) {
    console.log("[Page route] usePage - page not found for slug:", slug);
    status(404);
    return null;
  }

  if (page.status !== "published") {
    console.log("[Page route] usePage - page not published:", page.status);
    status(404);
    return null;
  }

  try {
    if (page.content && Array.isArray(page.content)) {
      console.log(
        "[Page route] usePage - page content length:",
        page.content.length,
        "sampleIds:",
        page.content.slice(0, 5).map((b: any) => b.id),
      );
    }
  } catch (err) {
    console.error("[Page route] usePage - error inspecting content:", err);
  }

  return page;
});

export default component$(() => {
  const page = usePage();

  console.log(
    "[Page route] Component rendering - page snapshot:",
    page.value
      ? {
          id: (page.value as any).id ?? null,
          title: (page.value as any).title ?? null,
          status: (page.value as any).status ?? null,
          contentLength: Array.isArray((page.value as any).content)
            ? (page.value as any).content.length
            : 0,
        }
      : null,
  );

  if (!page.value) {
    console.log("[Page route] Rendering page - page not found");
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
      {page.value.content && page.value.content.length > 0 ? (
        <div>
          {page.value.content
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
        </div>
      ) : (
        <div class="max-w-4xl mx-auto px-4 py-16">
          <h1 class="text-4xl font-bold text-gray-900 mb-4">
            {page.value.title}
          </h1>
          <p class="text-gray-600">
            This page is empty. Add content in the page builder.
          </p>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  // During client-side transitions to non-catch-all routes, this head can run
  // without usePage being executed for the current request.
  try {
    const page = resolveValue(usePage);

    if (!page) {
      return {
        title: "Page Not Found",
      };
    }

    return {
      title: page.title,
    };
  } catch {
    return {
      title: "Community Hub",
    };
  }
};
