import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { ArchivePostsViewData } from "~/contracts/archive-posts";
import { env } from "~/env";
import { postsService } from "~/services/posts.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { canonicalUrl } from "~/utils/seo";
import { ArchivePostsView } from "~theme/routes/archive-posts/ArchivePostsView";

const POSTS_PER_PAGE = 10;

export const useArchivePostsPage = routeLoader$(
	async (): Promise<ArchivePostsViewData> => {
		const page = 0;
		const result = await postsService.getPage(page, POSTS_PER_PAGE);
		const items = result.items.map((post) => ({
			...post,
			featuredImage: publicImageUrlFromKey(post.featuredImage, env.S3_BASE_URL),
		}));

		return {
			page,
			items,
			totalPages: result.totalPages,
			previousHref: null,
			nextHref:
				page + 1 < result.totalPages ? `/archive/posts/${page + 1}` : null,
		};
	},
);

export default component$(() => {
	const archivePage = useArchivePostsPage();
	return <ArchivePostsView data={archivePage.value} />;
});

export const head: DocumentHead = ({ url }) => ({
	title: "Post Archive",
	meta: [{ name: "description", content: "Browse all past community posts." }],
	links: [
		{ rel: "canonical", href: canonicalUrl("/archive/posts", url.origin) },
	],
});
