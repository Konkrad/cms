import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { HeroArticle } from "~/contracts/articles";
import { textExcerpt } from "~/core/content/content-items";
import { stream } from "~/core/content/stream.service";
import { publicImageUrlFromKey } from "~/core/media/images";
import { withItemUrls } from "~/core/registry/refs";
import { currentScope } from "~/core/router/scope-request";
import { scopeContentFilter } from "~/core/scopes/content-filter";

const fetchLatestArticles = server$(async function (): Promise<HeroArticle[]> {
	// The latest public articles of the page's scope listing, as a guest sees them.
	const rows = await stream.recent(
		await scopeContentFilter(null, await currentScope(this)),
		3,
		{ types: ["article"] },
	);
	const articles = rows.flatMap((r) => (r.type === "article" ? [r] : []));
	return (await withItemUrls("core:article", articles)).map((article) => ({
		id: article.id,
		url: article.url,
		title: article.title,
		excerpt: textExcerpt(article.body, 120),
		imageUrl: publicImageUrlFromKey(article.featuredImage),
		publishedAt: article.publishedAt ?? article.updatedAt,
	}));
});

/** Headless composable owning data-fetching for the "Hero Section" page-builder block. */
export function useHeroSection() {
	const articles = useSignal<HeroArticle[]>([]);
	const isLoading = useSignal(true);

	useTask$(async () => {
		try {
			articles.value = await fetchLatestArticles();
		} catch (e) {
			console.error("useHeroSection: Failed to fetch articles", e);
		} finally {
			isLoading.value = false;
		}
	});

	return { articles, isLoading };
}
