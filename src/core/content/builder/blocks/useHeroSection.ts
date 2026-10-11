import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { HeroPost } from "~/contracts/posts";
import { postsService } from "~/core/content/posts.service";
import { publicImageUrlFromKey } from "~/core/media/images";
import { withItemUrls } from "~/core/registry/refs";
import { currentScope } from "~/core/router/scope-request";
import { scopeContentFilter } from "~/core/scopes/content-filter";

const fetchLatestGlobalPosts = server$(async function (): Promise<HeroPost[]> {
	// The latest public posts of the page's scope listing (as a guest sees them).
	const res = await postsService.getVisiblePosts(
		await scopeContentFilter(null, await currentScope(this)),
		3,
	);
	return (await withItemUrls("core:post", res.items)).map((post) => ({
		...post,
		featuredImageUrl: publicImageUrlFromKey(post.featuredImage),
	}));
});

/** Headless composable owning data-fetching for the "Hero Section" page-builder block. */
export function useHeroSection() {
	const posts = useSignal<HeroPost[]>([]);
	const isLoading = useSignal(true);

	useTask$(async () => {
		try {
			posts.value = await fetchLatestGlobalPosts();
		} catch (e) {
			console.error("useHeroSection: Failed to fetch posts", e);
		} finally {
			isLoading.value = false;
		}
	});

	return { posts, isLoading };
}
