import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { pagesService } from "~/services/pages.service";
import { PageView } from "~theme/routes/page/PageView";

export const usePage = routeLoader$(async ({ params, status }) => {
  // Normalize slug to match database format (with leading slash)
  const slug = params.slug ? `/${params.slug}` : "/";

  const page = await pagesService.getByUrl(slug);

  if (!page) {
    status(404);
    return null;
  }

  if (page.status !== "published") {
    status(404);
    return null;
  }

  return page;
});

export default component$(() => {
  const page = usePage();
  return <PageView page={page.value} />;
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
      title: page.menuItem?.title ?? "Community Hub",
    };
  } catch {
    return {
      title: "Community Hub",
    };
  }
};
