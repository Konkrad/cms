import type { PostViewData } from "~/contracts/posts";
import { getCurrentUserData } from "~/core/auth/server-auth";
import { postsService } from "~/core/content/posts.service";
import { publicImageUrlFromKey } from "~/core/media/images";
import { requireCanonicalUrl } from "~/core/refs/canonical";
import { itemUrl, withItemUrls } from "~/core/registry/refs";
import { definePage } from "~/core/router/pages";
import { scopeContentFilter } from "~/core/scopes/content-filter";
import { formatUser } from "~/core/users/format";

/**
 * A post's page, served by the catch-all at its canonical URL under the owning scope
 * (`/germany/berlin/posts/<id>`); under any other scope prefix it answers 301 there.
 * Server-only (the view is `postPageView`).
 */
export const postDetailPage = definePage({
	id: "core.post",
	path: "/posts/:id",
	async load(event, { params }): Promise<PostViewData | null> {
		const post = await postsService.getById(params.id);
		const viewer = await getCurrentUserData(event);
		if (!post || !(await postsService.canView(post, viewer))) {
			event.status(404);
			return null;
		}
		const url = await itemUrl("core:post", post);
		requireCanonicalUrl(event, url);

		// Related: the listing of the post's own scope, as this viewer sees it.
		const recentPosts = await postsService.getRecent(
			await scopeContentFilter(viewer, post.scopeId),
			4,
		);
		const related = await withItemUrls(
			"core:post",
			recentPosts.filter((p) => p.id !== post.id).slice(0, 3),
		);

		// The service returns the author's public shape only; the theme sees exactly
		// PostViewData (see ~/contracts/posts).
		return {
			...post,
			url,
			featuredImageUrl: publicImageUrlFromKey(post.featuredImage),
			authorAvatarUrl: post.user.profilePictureSmallUrl,
			relatedPosts: related.map((p) => ({
				id: p.id,
				url: p.url,
				title: p.title,
				featuredImageUrl: publicImageUrlFromKey(p.featuredImage),
				createdAt: p.createdAt,
			})),
			user: formatUser(post.user, true),
		};
	},
});

/** Core pages the catch-all serves at the root and under every scope prefix. */
export const corePages = [postDetailPage];
