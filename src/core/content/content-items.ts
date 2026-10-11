/** Client-safe helpers for notes and articles (spec 4.4; no server imports). */

/**
 * The two core content types of the stream. A note is a short stream item without a title or
 * image ("Doors open at 18:00"); an article is long form with a title and an optional
 * featured image. The social web maps them to ActivityStreams `Note` and `Article` (spec 5.3).
 */
export type StreamType = "note" | "article";
export const STREAM_TYPES: readonly StreamType[] = ["note", "article"];

/** Which types a stream block or an archive shows (`StreamFilter` in ~/contracts/stream). */
export const STREAM_FILTERS = ["all", "notes", "articles"] as const;

export type StreamFilter = (typeof STREAM_FILTERS)[number];

/** Archive titles by filter (`/archive/all`, `/archive/notes`, `/archive/articles`). */
export const ARCHIVE_TITLES: Record<StreamFilter, string> = {
	all: "News Archive",
	notes: "Notes Archive",
	articles: "Article Archive",
};

/** A URL segment or block setting as a filter, or null for an unknown one. */
export function archiveFilter(value: string | undefined): StreamFilter | null {
	return (STREAM_FILTERS as readonly string[]).includes(value ?? "")
		? (value as StreamFilter)
		: null;
}

/** The types a filter shows; anything unknown shows both. */
export function streamFilterTypes(
	show: string | null | undefined,
): StreamType[] {
	if (show === "notes") return ["note"];
	if (show === "articles") return ["article"];
	return ["note", "article"];
}

/**
 * The longest note, in characters of text (markup and link targets do not count): about a
 * long paragraph, room for "Doors open at 18:00, bring a friend" plus a link or two, short
 * enough to show whole in a stream. Anything longer is an article.
 */
export const NOTE_MAX_LENGTH = 1000;

export const ARTICLE_TITLE_MAX_LENGTH = 200;

/** Where article images are uploaded (`/api/images` `x-upload-path`, public S3 objects). */
export const ARTICLE_IMAGE_PATH = "public/articles";

/**
 * Key prefixes a stored article image may have: new uploads, and images of posts from before
 * notes and articles (uploaded to `public/posts/` and kept by the migration).
 */
export const ARTICLE_IMAGE_PREFIXES: readonly string[] = [
	`${ARTICLE_IMAGE_PATH}/`,
	"public/posts/",
];

/** Whether `key` may be stored as an article's featured image (a public article image key). */
export function isArticleImageKey(key: string): boolean {
	return (
		ARTICLE_IMAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
		!key.includes("..") &&
		/^[A-Za-z0-9._/-]+$/.test(key)
	);
}

export function formatContentDate(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(new Date(date));
}

export function toPlainText(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

/** A short plain-text excerpt of a body (cards, link picker labels, admin lists). */
export function textExcerpt(html: string, max = 160): string {
	const text = toPlainText(html);
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Input the editor can fix (shown in the form); anything else is a bug and bubbles up. */
export class ContentInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ContentInputError";
	}
}
