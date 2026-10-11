/** Client-safe post helpers (no server imports). */

/**
 * The two layouts of a post (spec 4.4): a post without a title is a note (shown whole, like a
 * status update), a post with a title is an article (title, then the body; a card in listings).
 * The social web maps them to ActivityStreams `Note` and `Article` (spec 5.3).
 */
export type PostKind = "note" | "article";

/** A title as stored: trimmed, and null when blank (a note has no title). */
export function normalizePostTitle(
	title: string | null | undefined,
): string | null {
	const trimmed = (title ?? "").trim();
	return trimmed ? trimmed : null;
}

/** Which layout shows a post: `note` without a title, `article` with one. */
export function postKind(post: { title: string | null | undefined }): PostKind {
	return normalizePostTitle(post.title) ? "article" : "note";
}

export function formatPostDate(date: string): string {
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
export function postExcerpt(html: string, max = 160): string {
	const text = toPlainText(html);
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A post input the editor can fix (shown in the form); anything else is a bug and bubbles up. */
export class PostInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PostInputError";
	}
}
