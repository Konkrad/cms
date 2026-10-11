import { component$ } from "@qwik.dev/core";
import type { PostViewData } from "~/contracts/posts";
import { canonicalUrl } from "~/core/content/seo";
import type { PageViews } from "~/core/router/page-views";
import { PostView } from "~theme/routes/posts/PostView";

const PostPage = component$<{ data: PostViewData | null }>(({ data }) => (
	<PostView post={data} />
));

/** A note has no title: its page title is the start of its text. */
function pageTitle(post: PostViewData): string {
	if (post.title) return post.title;
	const text = post.excerpt;
	return text.length > 60 ? `${text.slice(0, 59).trimEnd()}…` : text;
}

function postHead(data: unknown, url: URL) {
	const post = data as PostViewData | null;
	if (!post) return { title: "Post Not Found" };

	const canonical = canonicalUrl(url.pathname, url.origin);
	const title = pageTitle(post);
	const isArticle = post.kind === "article";

	return {
		title,
		meta: [
			{ name: "description", content: post.excerpt },
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: title },
			{ property: "og:description", content: post.excerpt },
			{ property: "og:url", content: canonical },
		],
		links: [{ rel: "canonical", href: canonical }],
		scripts: [
			{
				type: "application/ld+json",
				script: JSON.stringify({
					"@context": "https://schema.org",
					// A note is a short social post, an article an article.
					"@type": isArticle ? "Article" : "SocialMediaPosting",
					headline: isArticle ? post.title : undefined,
					articleBody: isArticle ? undefined : post.excerpt,
					datePublished: post.publishedAt,
					dateModified: post.updatedAt,
					author: { "@type": "Person", name: post.author.displayName },
				}),
			},
		],
	};
}

/** Views of the core pages served by the catch-all (client-safe). */
export const coreViews: PageViews = {
	"core.post": { view: PostPage, head: postHead },
};
