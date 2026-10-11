import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { HeroPost } from "~/contracts/posts";
import { postExcerpt } from "~/core/content/posts";
import { postsService } from "~/core/content/posts.service";
import { withItemUrls } from "~/core/registry/refs";
import { currentScope } from "~/core/router/scope-request";
import { scopeContentFilter } from "~/core/scopes/content-filter";

const fetchLatestArticles = server$(async function (): Promise<HeroPost[]> {
	// The latest public articles (titled posts) of the page's scope listing, as a guest sees them.
	const res = await postsService.getAll(
		await scopeContentFilter(null, await currentScope(this)),
		3,
		null,
		"forward",
		{ articlesOnly: true },
	);
	return (await withItemUrls("core:post", res.items)).map((post) => ({
		id: post.id,
		url: post.url,
		title: post.title ?? "",
		excerpt: postExcerpt(post.body, 120),
		publishedAt: post.publishedAt ?? post.updatedAt,
	}));
});

/** Headless composable owning data-fetching for the "Hero Section" page-builder block. */
export function useHeroSection() {
	const posts = useSignal<HeroPost[]>([]);
	const isLoading = useSignal(true);

	useTask$(async () => {
		try {
			posts.value = await fetchLatestArticles();
		} catch (e) {
			console.error("useHeroSection: Failed to fetch posts", e);
		} finally {
			isLoading.value = false;
		}
	});

	return { posts, isLoading };
}
