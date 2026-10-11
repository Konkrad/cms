import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { ArchivePostsViewData } from "~/contracts/archive-posts";
import { getServerSession } from "~/core/auth/server-auth";
import { toPostCards } from "~/core/content/post-cards";
import { postsService } from "~/core/content/posts.service";
import { canonicalUrl } from "~/core/content/seo";
import { requestContentFilter } from "~/core/scopes/content-filter";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { ArchivePostsView } from "~theme/routes/archive-posts/ArchivePostsView";

const POSTS_PER_PAGE = 10;

export const useArchivePostsPage = routeLoader$(
	async (event): Promise<ArchivePostsViewData> => {
		const { params, status } = event;
		const parsedPage = Number.parseInt(params.page ?? "", 10);

		if (!Number.isInteger(parsedPage) || parsedPage < 1) {
			status(404);
			return null;
		}

		const result = await postsService.getPage(
			await requestContentFilter(event),
			parsedPage,
			POSTS_PER_PAGE,
		);

		if (parsedPage >= result.totalPages) {
			status(404);
			return null;
		}

		const viewer = await getServerSession(event);
		const items = await toPostCards(result.items, { loggedIn: !!viewer });

		return assertNoPrivateFields({
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
		});
	},
);

export default component$(() => {
	const archivePage = useArchivePostsPage();
	return <ArchivePostsView data={archivePage.value} />;
});

// Paginated archive listings beyond page 1 are thin/duplicate content (same
// layout, no unique text) — keep them out of the index and point crawlers
// back at the canonical first page instead.
export const head: DocumentHead = ({ url }) => ({
	title: "Post Archive",
	meta: [{ name: "robots", content: "noindex, follow" }],
	links: [
		{ rel: "canonical", href: canonicalUrl("/archive/posts", url.origin) },
	],
});
