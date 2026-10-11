import type { PostCardData, PostSubject } from "~/contracts/posts";
import { postExcerpt, postKind } from "~/core/content/posts";
import type { PostWithAuthor } from "~/core/content/posts.service";
import {
	describeRef,
	renderRichHtmlList,
	withItemUrls,
} from "~/core/registry/refs";
import { buildProfileUrl } from "~/core/users/format";
import type { PublicUser } from "~/core/users/public-user";

/**
 * Server-only: posts as the theme gets them (`PostCardData`, ~/contracts/posts). Bodies get
 * their current link URLs; notes carry the whole body, articles an excerpt.
 */

/** The author as a viewer may see them: first name for guests, full name when logged in. */
export function toPostAuthor(author: PublicUser, loggedIn: boolean) {
	return {
		id: author.id,
		displayName: loggedIn ? `${author.name} ${author.familyName}` : author.name,
		profileUrl: buildProfileUrl(author),
	};
}

export async function toPostCards(
	posts: readonly PostWithAuthor[],
	options: { loggedIn: boolean; sources?: Record<string, string> },
): Promise<PostCardData[]> {
	const withUrls = await withItemUrls("core:post", posts);
	const notes = withUrls.filter((p) => postKind(p) === "note");
	const rendered = await renderRichHtmlList(notes.map((p) => p.body));
	const bodies = new Map(notes.map((p, i) => [p.id, rendered[i]]));
	return withUrls.map((p) => {
		const kind = postKind(p);
		return {
			id: p.id,
			url: p.url,
			kind,
			title: kind === "article" ? p.title : null,
			body: bodies.get(p.id) ?? null,
			excerpt: postExcerpt(p.body, kind === "article" ? 180 : 280),
			publishedAt: p.publishedAt ?? p.updatedAt,
			visibility: p.visibility,
			author: toPostAuthor(p.author, options.loggedIn),
			source: options.sources?.[p.scopeId] ?? null,
		};
	});
}

/**
 * The item a post is about, as a link: its current URL and title, or null when the reference
 * no longer resolves (the item is gone or its module is inactive).
 */
export async function postSubject(post: {
	subjectType: string | null;
	subjectId: string | null;
}): Promise<PostSubject | null> {
	if (!post.subjectType || !post.subjectId) return null;
	const ref = `${post.subjectType}:${post.subjectId}`;
	const described = await describeRef(ref);
	return described
		? { url: described.url, title: described.title ?? ref }
		: null;
}
