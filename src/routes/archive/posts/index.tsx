import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { postsService } from "~/services/posts.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { ArchivePostsView } from "~theme/routes/archive-posts/ArchivePostsView";
import type { ArchivePostsViewData } from "~/contracts/archive-posts";

const POSTS_PER_PAGE = 10;

export const useArchivePostsPage = routeLoader$(async (): Promise<ArchivePostsViewData> => {
  const page = 0;
  const result = await postsService.getPage(page, POSTS_PER_PAGE);
  const items = result.items.map((post) => ({
    ...post,
    featuredImage: publicImageUrlFromKey(post.featuredImage),
  }));

  return {
    page,
    items,
    totalPages: result.totalPages,
    previousHref: null,
    nextHref: page + 1 < result.totalPages ? `/archive/posts/${page + 1}` : null,
  };
});

export default component$(() => {
  const archivePage = useArchivePostsPage();
  return <ArchivePostsView data={archivePage.value} />;
});
