import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import type { PostViewData } from "~/contracts/posts";
import { getCurrentUserData } from "~/core/auth/server-auth";
import { postsService } from "~/core/content/posts.service";
import { canonicalUrl, htmlToDescription } from "~/core/content/seo";
import { publicImageUrlFromKey } from "~/core/media/images";
import { scopeContentFilter } from "~/core/scopes/content-filter";
import { assertNoPrivateFields } from "~/core/shared/no-private-fields";
import { formatUser } from "~/core/users/format";
import { PostView } from "~theme/routes/posts/PostView";

export const usePost = routeLoader$(
	async (event): Promise<PostViewData | null> => {
		const { params, status } = event;
		const { id } = params;

		if (!id) {
			status(404);
			return null;
		}

		const post = await postsService.getById(id);
		const viewer = await getCurrentUserData(event);

		if (!post || !(await postsService.canView(post, viewer))) {
			status(404);
			return null;
		}

		// Resolve image URLs server-side
		const featuredImageUrl = publicImageUrlFromKey(post.featuredImage);

		const authorAvatarUrl = post.user.profilePictureSmallUrl;

		// Fetch related posts (recent, excluding this one)
		// Related: the listing of the post's own scope, as this viewer sees it.
		const recentPosts = await postsService.getRecent(
			await scopeContentFilter(viewer, post.scopeId),
			4,
		);
		const relatedPosts = recentPosts
			.filter((p) => p.id !== id)
			.slice(0, 3)
			.map((p) => ({
				id: p.id,
				title: p.title,
				featuredImageUrl: publicImageUrlFromKey(p.featuredImage),
				createdAt: p.createdAt,
			}));

		// The service returns the author's public shape only; the theme sees exactly
		// PostViewData (see ~/contracts/posts).
		return assertNoPrivateFields({
			...post,
			featuredImageUrl,
			authorAvatarUrl,
			relatedPosts,
			user: formatUser(post.user, true),
		});
	},
);

export default component$(() => {
	const post = usePost();
	return <PostView post={post.value} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	const post = resolveValue(usePost);

	if (!post) {
		return { title: "Post Not Found" };
	}

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
};
