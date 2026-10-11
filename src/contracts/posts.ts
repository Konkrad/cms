/**
 * Core → theme data contracts for posts (spec 4.4).
 *
 * Payload types are DECLARED here (the loaders return exactly these types), so a new field
 * reaches the page only by adding it to the contract. Theme components import these types
 * (`~/contracts/posts`) instead of deep-importing route files or reaching into services.
 * `import type` only — these carry no runtime code.
 *
 * One post type, two layouts: `kind` is "note" for an untitled post (shown whole, like a status
 * update) and "article" for a titled one (title first; a card with an excerpt in listings).
 * Listings and feeds mix both. The theme picks the layout from `kind` only.
 */

import type { PostKind } from "~/core/content/posts";
import type { Visibility } from "~/core/scopes/visibility";

export type { PostKind };

/** The author as any viewer may see them (public profile). */
export type PostAuthor = {
	id: string;
	/** First name for guests, full name for logged-in viewers. */
	displayName: string;
	profileUrl: string;
};

/** The item a post is about (an event), when it still resolves. */
export type PostSubject = {
	/** Current URL of the item. */
	url: string;
	/** Label of the item (its title). */
	title: string;
};

/** One post in a listing, a feed or under the item it is about. */
export type PostCardData = {
	id: string;
	/** Canonical URL under the owning scope. */
	url: string;
	kind: PostKind;
	/** Null for a note. */
	title: string | null;
	/** Sanitized HTML with current link URLs: the whole note; null for an article (see excerpt). */
	body: string | null;
	/** Plain-text excerpt of the body. */
	excerpt: string;
	publishedAt: string;
	visibility: Visibility;
	author: PostAuthor;
	/** Name of the owning scope when a listing shows it outside that scope (content flowing in). */
	source?: string | null;
};

/** Payload of `<scope path>/posts/:id` (declared, not derived: it shows the author). */
export type PostViewData = {
	id: string;
	/** Canonical URL under the owning scope. */
	url: string;
	kind: PostKind;
	title: string | null;
	/** Sanitized HTML with current link URLs. */
	body: string;
	/** Plain-text summary (meta description, note page title). */
	excerpt: string;
	publishedAt: string;
	updatedAt: string;
	visibility: Visibility;
	author: PostAuthor & {
		/** The author's public thumbnail URL. */
		avatarUrl: string | null;
	};
	subject: PostSubject | null;
	/** Other posts of the same scope listing, notes and articles mixed. */
	relatedPosts: PostCardData[];
};

/** Post list page as returned by `~/core/content/builder/blocks/usePostsList`. */
export type PostsPage = {
	items: PostCardData[];
	nextCursor: string | null;
	prevCursor: string | null;
};

/** Hero post (an article) as returned by `~/core/content/builder/blocks/useHeroSection`. */
export type HeroPost = {
	id: string;
	url: string;
	title: string;
	excerpt: string;
	publishedAt: string;
};
