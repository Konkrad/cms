import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { HeroPost } from "~/contracts/posts";
import { postsService } from "~/services/posts.service";
import { publicImageUrlFromKey } from "~/utils/images";

const fetchLatestGlobalPosts = server$(async (): Promise<HeroPost[]> => {
	const res = await postsService.getVisiblePosts(null, 3);
	return res.items.map((post) => ({
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
