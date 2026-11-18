import type { ContentTombstone, StreamType } from "~/core";
import type { FeedItem } from "./items";
import { socialUrls } from "./urls";

/**
 * ActivityStreams 2.0 documents of the site-wide, pull-only actor (spec 5.3), pure.
 * - FEP-b06c (ActivityPoll): actor with `pollOnly` and `updateInterval`, outbox in reverse
 *   chronological order, deleted items as `Tombstone`s.
 * - FEP-b2b8 (long-form text): a note is a `Note`; an article is an `Article` with `name`,
 *   `summary`, full `content`, `image` and a `preview` `Note` for stream-only consumers.
 * Everything is addressed to the public; nothing is ever delivered.
 */

export const AS_CONTEXT = "https://www.w3.org/ns/activitystreams";
export const POLL_CONTEXT = "https://w3id.org/fep/b06c";
export const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

export type AsDocument = Record<string, unknown>;

const AS_TYPES: Record<StreamType, "Note" | "Article"> = {
	note: "Note",
	article: "Article",
};

/** Text for an HTML property (`summary`, `content`). */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Settings and site data the actor is built from. */
export interface ActorInfo {
	account: string;
	name: string;
	summary: string;
	/** The site's home page. */
	siteUrl: string;
	/** Absolute URL of the icon. */
	iconUrl: string;
	iconType: string;
	/** xsd:duration, e.g. "P1D". */
	updateInterval: string;
}

export function actorDocument(info: ActorInfo): AsDocument {
	const urls = socialUrls();
	return {
		"@context": [AS_CONTEXT, POLL_CONTEXT],
		id: urls.actor,
		type: "Service",
		preferredUsername: info.account,
		name: info.name,
		summary: `<p>${escapeHtml(info.summary || info.name)}</p>`,
		url: info.siteUrl,
		icon: { type: "Image", url: info.iconUrl, mediaType: info.iconType },
		inbox: urls.inbox,
		outbox: urls.outbox,
		pollOnly: true,
		updateInterval: info.updateInterval,
		to: [PUBLIC],
	};
}

const updatedOf = (item: FeedItem) =>
	item.updatedAt > item.publishedAt ? { updated: item.updatedAt } : {};

/** A note as a `Note`; an article as an `Article` with a `preview` `Note` (FEP-b2b8). */
export function toAsObject(item: FeedItem): AsDocument {
	const { actor } = socialUrls();
	const common = {
		id: item.objectId,
		type: AS_TYPES[item.type],
		attributedTo: actor,
		url: item.url,
		published: item.publishedAt,
		...updatedOf(item),
		to: [PUBLIC],
	};
	if (item.type === "note") {
		return { ...common, content: item.html, mediaType: "text/html" };
	}
	const title = item.title ?? "";
	const summary = `<p>${escapeHtml(item.excerpt)}</p>`;
	const image = item.image
		? { type: "Image", url: item.image.url, mediaType: item.image.mediaType }
		: null;
	return {
		...common,
		name: title,
		summary,
		content: item.html,
		mediaType: "text/html",
		...(image ? { image } : {}),
		preview: {
			type: "Note",
			attributedTo: actor,
			content: `<p><strong>${escapeHtml(title)}</strong></p>${summary}`,
			published: item.publishedAt,
			...(image ? { attachment: [image] } : {}),
		},
	};
}

/** What a note or article left behind: a `Tombstone` with its former type (AS2). */
export function toTombstone(tombstone: ContentTombstone): AsDocument {
	return {
		id: socialUrls().object(tombstone.type, tombstone.itemId),
		type: "Tombstone",
		formerType: AS_TYPES[tombstone.type],
		published: tombstone.publishedAt,
		deleted: tombstone.deletedAt,
	};
}

/** The `Create` of an item; its object is a `Tombstone` once the item left the feeds. */
export function createActivity(
	type: StreamType,
	id: string,
	published: string,
	object: AsDocument,
): AsDocument {
	const urls = socialUrls();
	return {
		id: urls.activity("create", type, id),
		type: "Create",
		actor: urls.actor,
		published,
		to: [PUBLIC],
		object,
	};
}

/** The `Delete` of an item that left the public feeds (deleted or no longer public). */
export function deleteActivity(tombstone: ContentTombstone): AsDocument {
	const urls = socialUrls();
	return {
		id: urls.activity("delete", tombstone.type, tombstone.itemId),
		type: "Delete",
		actor: urls.actor,
		published: tombstone.deletedAt,
		to: [PUBLIC],
		object: toTombstone(tombstone),
	};
}
