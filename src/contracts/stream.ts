/**
 * Core → theme data contracts shared by notes and articles (spec 4.4), and the mixed stream.
 *
 * Payload types are DECLARED here and in `notes.ts` / `articles.ts` (the loaders return exactly
 * these types), so a new field reaches the page only by adding it to the contract. Theme
 * components import these types instead of deep-importing route files or reaching into
 * services. `import type` only — these carry no runtime code.
 *
 * Notes and articles are two types. Listings that show both (news, scope home, related items,
 * updates about an event, archives) are `StreamItemData[]`, newest first: render each item by
 * its `type` (`StreamCard` in the theme).
 */

import type { ArticleCardData } from "~/contracts/articles";
import type { NoteCardData } from "~/contracts/notes";
import type { StreamFilter, StreamType } from "~/core/content/content-items";

/** `StreamFilter`: which types a stream block or an archive shows ("all", "notes", "articles"). */
export type { StreamFilter, StreamType };

/** The author as any viewer may see them (public profile). */
export type ContentAuthor = {
	id: string;
	/** First name for guests, full name for logged-in viewers. */
	displayName: string;
	profileUrl: string;
};

/** The item a note or an article is about (an event), when it still resolves. */
export type ContentSubject = {
	/** Current URL of the item. */
	url: string;
	/** Label of the item (its title). */
	title: string;
};

/** One item of a mixed listing: a note or an article, told apart by `type`. */
export type StreamItemData = NoteCardData | ArticleCardData;

/** A cursor page of the stream, as returned by `~/core/content/builder/blocks/useStream`. */
export type StreamPage = {
	items: StreamItemData[];
	nextCursor: string | null;
	prevCursor: string | null;
};
