/**
 * Core → theme data contracts for articles (spec 4.4): long form with a title, an optional
 * featured image and rich text. Declared, not derived: they show the author. See `stream.ts`.
 */

import type {
	ContentAuthor,
	ContentSubject,
	StreamItemData,
} from "~/contracts/stream";
import type { Visibility } from "~/core/scopes/visibility";

/** One article in a listing, a feed or under the item it is about. */
export type ArticleCardData = {
	type: "article";
	id: string;
	/** Canonical URL under the owning scope (`<scope>/articles/<id>`). */
	url: string;
	title: string;
	/** Plain-text excerpt of the body. */
	excerpt: string;
	/** Public URL of the featured image, if it has one. */
	imageUrl: string | null;
	publishedAt: string;
	visibility: Visibility;
	author: ContentAuthor;
	/** Name of the owning scope when a listing shows it outside that scope (content flowing in). */
	source?: string | null;
};

/** Payload of `<scope path>/articles/:id`. */
export type ArticleViewData = {
	id: string;
	url: string;
	title: string;
	/** Sanitized HTML with current link URLs. */
	body: string;
	/** Plain-text summary (meta description). */
	excerpt: string;
	/** Public URL of the featured image (also og:image), if it has one. */
	imageUrl: string | null;
	publishedAt: string;
	updatedAt: string;
	visibility: Visibility;
	author: ContentAuthor & {
		/** The author's public thumbnail URL. */
		avatarUrl: string | null;
	};
	subject: ContentSubject | null;
	/** Other items of the same scope listing, notes and articles mixed. */
	related: StreamItemData[];
};

/** Hero slide (an article) as returned by `~/core/content/builder/blocks/useHeroSection`. */
export type HeroArticle = {
	id: string;
	url: string;
	title: string;
	excerpt: string;
	imageUrl: string | null;
	publishedAt: string;
};
