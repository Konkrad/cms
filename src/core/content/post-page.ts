import type { PostViewData } from "~/contracts/posts";
import { getCurrentUserData } from "~/core/auth/server-auth";
import {
	postSubject,
	toPostAuthor,
	toPostCards,
} from "~/core/content/post-cards";
import { postExcerpt, postKind } from "~/core/content/posts";
import { postsService } from "~/core/content/posts.service";
import { requireCanonicalUrl } from "~/core/refs/canonical";
import { itemUrl, renderRichHtml } from "~/core/registry/refs";
import { definePage } from "~/core/router/pages";
import { scopeContentFilter } from "~/core/scopes/content-filter";

/**
 * A post's page, served by the catch-all at its canonical URL under the owning scope
 * (`/germany/berlin/posts/<id>`); under any other scope prefix it answers 301 there. The view
 * picks the note or article layout from `kind`. Server-only (the view is in `post-view.tsx`).
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
		const recent = await postsService.getRecent(
			await scopeContentFilter(viewer, post.scopeId),
			4,
		);
		const relatedPosts = await toPostCards(
			recent.filter((p) => p.id !== post.id).slice(0, 3),
			{ loggedIn: !!viewer },
		);

		// The service returns the author's public shape only; the theme sees exactly
		// PostViewData (see ~/contracts/posts).
		return {
			id: post.id,
			url,
			kind: postKind(post),
			title: post.title,
			// Stored `ref:` links get their current URL; links to items that are gone are dropped.
			body: await renderRichHtml(post.body),
			excerpt: postExcerpt(post.body, 160),
			publishedAt: post.publishedAt ?? post.updatedAt,
			updatedAt: post.updatedAt,
			visibility: post.visibility,
			author: {
				...toPostAuthor(post.author, !!viewer),
				avatarUrl: post.author.profilePictureSmallUrl,
			},
			subject: await postSubject(post),
			relatedPosts,
		};
	},
});

/** Core pages the catch-all serves at the root and under every scope prefix. */
export const corePages = [postDetailPage];
