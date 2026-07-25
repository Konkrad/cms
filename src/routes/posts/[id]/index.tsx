import { component$ } from "@qwik.dev/core";
import { type DocumentHead, routeLoader$ } from "@qwik.dev/router";
import { postsService } from "~/services/posts.service";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";
import { canonicalUrl, htmlToDescription } from "~/utils/seo";
import { formatUser } from "~/utils/users";
import { PostView } from "~theme/routes/posts/PostView";

export const usePost = routeLoader$(async ({ params, status }) => {
	const { id } = params;

	if (!id) {
		status(404);
		return null;
	}

	const post = await postsService.getById(id);

	if (!post) {
		status(404);
		return null;
	}

	// Resolve image URLs server-side
	const featuredImageUrl = publicImageUrlFromKey(post.featuredImage);

	let authorAvatarUrl: string | null = null;
	if (post.user?.profilePicture) {
		const thumbKey =
			(post.user as any).profilePictureSmall ??
			deriveThumbnailKey(post.user.profilePicture);
		authorAvatarUrl = publicImageUrlFromKey(thumbKey);
	}

	// Fetch related posts (recent, excluding this one)
	const recentPosts = await postsService.getRecent(4);
	const relatedPosts = recentPosts
		.filter((p) => p.id !== id)
		.slice(0, 3)
		.map((p) => ({
			id: p.id,
			title: p.title,
			featuredImageUrl: publicImageUrlFromKey(p.featuredImage),
			createdAt: p.createdAt,
		}));

	// `formatUser(..., true)` strips PII before serialization; the theme only ever
	// sees what this loader returns (see ~/contracts/posts → PostViewData).
	return {
		...post,
		featuredImageUrl,
		authorAvatarUrl,
		relatedPosts,
		user: formatUser(post.user, true),
	};
});

export default component$(() => {
	const post = usePost();
	return <PostView post={post.value} />;
});

export const head: DocumentHead = ({ resolveValue, url }) => {
	const post = resolveValue(usePost);

	if (!post) {
		return { title: "Post Not Found" };
	}

	const canonical = canonicalUrl(url.pathname);
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
