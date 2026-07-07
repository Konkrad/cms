import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { postsService } from "~/services/posts.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { useThemeComponent$ } from "~/utils/theme-loader";
import { ThemeComponent } from "~/utils/theme-components";
import type { ArchivePostsViewData } from "~/contracts/archive-posts";
import type { FC } from "react";

const POSTS_PER_PAGE = 10;

export const useArchivePostsPage = routeLoader$(
  async ({ params, status }): Promise<ArchivePostsViewData> => {
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

    const items = result.items.map((post) => ({
      ...post,
      featuredImage: publicImageUrlFromKey(post.featuredImage),
    }));

    return {
      page: parsedPage,
      items,
      totalPages: result.totalPages,
      previousHref:
        parsedPage === 1
          ? "/archive/posts"
          : `/archive/posts/${parsedPage - 1}`,
      nextHref:
        parsedPage + 1 < result.totalPages
          ? `/archive/posts/${parsedPage + 1}`
          : null,
    };
  },
);

export default component$(() => {
  const archivePage = useArchivePostsPage();
  const ArchivePostsView = useThemeComponent$(() => import("~theme/routes/archive-posts/ArchivePostsView"));
  return (
    <ThemeComponent resource={ArchivePostsView} data={archivePage.value} />
  );
});
