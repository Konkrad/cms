import {
	publicImageUrlFromKey,
	renderRichHtml,
	type StreamRow,
	type StreamType,
	textExcerpt,
	withItemUrls,
} from "~/core";
import { absoluteUrl, socialUrls } from "./urls";

/**
 * A public note or article as the feeds publish it (RSS and ActivityStreams). Only public data:
 * the author is their public first name, as guests see it on the site.
 */
export interface FeedItem {
	type: StreamType;
	id: string;
	/** The canonical HTML page (absolute). */
	url: string;
	/** Stable JSON IRI (`/social/objects/<type>/<id>`): AS2 `id` and RSS `guid`. */
	objectId: string;
	/** An article's title; null for a note, which has none. */
	title: string | null;
	/** Sanitized body with internal links resolved to absolute URLs. */
	html: string;
	/** Plain-text excerpt (an article's summary). */
	excerpt: string;
	/** An article's featured image (absolute URL). */
	image: { url: string; mediaType: string } | null;
	authorName: string;
	publishedAt: string;
	updatedAt: string;
}

const IMAGE_TYPES: Record<string, string> = {
	avif: "image/avif",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	svg: "image/svg+xml",
	webp: "image/webp",
};

export function imageMediaType(url: string): string {
	const ext = new URL(url).pathname.split(".").pop()?.toLowerCase() ?? "";
	return IMAGE_TYPES[ext] ?? "image/jpeg";
}

/** Site-relative `href`/`src` values of stored HTML made absolute (feeds are read elsewhere). */
export function absolutizeLinks(html: string): string {
	return html.replace(
		/(\s(?:href|src))="(\/(?!\/)[^"]*)"/g,
		(_, attr: string, path: string) => `${attr}="${absoluteUrl(path)}"`,
	);
}

/** The feed form of public stream rows (from `publicFeed`), in the same order. */
export async function toFeedItems(
	rows: readonly StreamRow[],
): Promise<FeedItem[]> {
	const [noteUrls, articleUrls] = await Promise.all([
		withItemUrls(
			"core:note",
			rows.filter((r) => r.type === "note"),
		),
		withItemUrls(
			"core:article",
			rows.filter((r) => r.type === "article"),
		),
	]);
	const urls = new Map(
		[...noteUrls, ...articleUrls].map((r) => [`${r.type}:${r.id}`, r.url]),
	);
	const urlsOf = socialUrls();
	return Promise.all(
		rows.map(async (row) => {
			const image =
				row.type === "article"
					? publicImageUrlFromKey(row.featuredImage)
					: null;
			const imageUrl = image ? absoluteUrl(image) : null;
			return {
				type: row.type,
				id: row.id,
				url: absoluteUrl(urls.get(`${row.type}:${row.id}`) ?? "/"),
				objectId: urlsOf.object(row.type, row.id),
				title: row.type === "article" ? row.title : null,
				html: absolutizeLinks(await renderRichHtml(row.body)),
				excerpt: textExcerpt(row.body, 300),
				image: imageUrl
					? { url: imageUrl, mediaType: imageMediaType(imageUrl) }
					: null,
				authorName: row.author.name,
				publishedAt: row.publishedAt ?? row.updatedAt,
				updatedAt: row.updatedAt,
			};
		}),
	);
}
