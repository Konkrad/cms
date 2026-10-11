import { component$ } from "@qwik.dev/core";
import type { PostViewData } from "~/contracts/posts";
import { canonicalUrl, htmlToDescription } from "~/core/content/seo";
import type { PageViews } from "~/core/router/page-views";
import { PostView } from "~theme/routes/posts/PostView";

const PostPage = component$<{ data: PostViewData | null }>(({ data }) => (
	<PostView post={data} />
));

function postHead(data: unknown, url: URL) {
	const post = data as PostViewData | null;
	if (!post) return { title: "Post Not Found" };

	const canonical = canonicalUrl(url.pathname, url.origin);
	const description = htmlToDescription(post.body);

	return {
		title: post.title,
		meta: [
			{ name: "description", content: description },
			{ property: "og:type", content: "article" },
			{ property: "og:title", content: post.title },
			{ property: "og:description", content: description },
			{ property: "og:url", content: canonical },
			...(post.featuredImageUrl
				? [{ property: "og:image", content: post.featuredImageUrl }]
				: []),
		],
		links: [{ rel: "canonical", href: canonical }],
		scripts: [
			{
				type: "application/ld+json",
				script: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "Article",
					headline: post.title,
					datePublished: post.createdAt,
					dateModified: post.updatedAt,
					image: post.featuredImageUrl ?? undefined,
					author: post.showAuthor
						? { "@type": "Person", name: post.user.name }
						: undefined,
				}),
			},
		],
	};
}

/** Views of the core pages served by the catch-all (client-safe). */
export const coreViews: PageViews = {
	"core.post": { view: PostPage, head: postHead },
};
