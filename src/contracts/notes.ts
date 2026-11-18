/**
 * Core → theme data contracts for notes (spec 4.4): short stream items without a title or
 * image, shown whole. Declared, not derived: they show the author. See `stream.ts`.
 */

import type {
	ContentAuthor,
	ContentSubject,
	StreamItemData,
} from "~/contracts/stream";
import type { Visibility } from "~/core/scopes/visibility";

/** One note in a listing, a feed or under the item it is about. */
export type NoteCardData = {
	type: "note";
	id: string;
	/** Canonical URL under the owning scope (`<scope>/notes/<id>`). */
	url: string;
	/** Sanitized HTML (links only) with current link URLs: the whole note. */
	body: string;
	publishedAt: string;
	visibility: Visibility;
	author: ContentAuthor;
	/** Name of the owning scope when a listing shows it outside that scope (content flowing in). */
	source?: string | null;
};

/** Payload of `<scope path>/notes/:id`. */
export type NoteViewData = {
	id: string;
	url: string;
	/** Sanitized HTML with current link URLs. */
	body: string;
	/** Plain-text summary (meta description, page title). */
	excerpt: string;
	publishedAt: string;
	updatedAt: string;
	visibility: Visibility;
	author: ContentAuthor & {
		/** The author's public thumbnail URL. */
		avatarUrl: string | null;
	};
	subject: ContentSubject | null;
	/** Newer and older items of the same scope listing, notes and articles mixed. */
	related: StreamItemData[];
};
