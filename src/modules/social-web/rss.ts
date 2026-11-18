/**
 * RSS 2.0 (https://www.rssboard.org/rss-specification), pure. Spec 5.3: an untitled item (a
 * note) has no `<title>` element and its full text in `<description>`; we never invent titles.
 */

export interface RssChannel {
	title: string;
	/** The site's home page. */
	link: string;
	description: string;
	/** This feed's own URL (`atom:link rel="self"`). */
	selfUrl: string;
	/** ISO timestamp of the newest change, or null for an empty feed. */
	lastBuildDate: string | null;
	language?: string;
}

export interface RssItem {
	/** Plain text; null for a note (no `<title>` element at all). */
	title: string | null;
	link: string;
	/** Stable identifier (not the page URL, so `isPermaLink="false"`). */
	guid: string;
	/** HTML for a note (its whole text), plain text for an article (its excerpt). */
	description: string;
	descriptionIsHtml: boolean;
	/** Full HTML of an article (`content:encoded`). */
	content?: string | null;
	/** The author's public name. */
	author: string;
	/** ISO timestamp. */
	pubDate: string;
	image?: { url: string; type: string } | null;
}

/** Characters XML 1.0 forbids (control characters other than tab, newline, return). */
const INVALID_XML_CHARS =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
	/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Text or attribute value, entity-escaped. */
export function escapeXml(value: string): string {
	return value
		.replace(INVALID_XML_CHARS, "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/** A CDATA section holding `value` verbatim; a `]]>` inside is split across two sections. */
export function cdata(value: string): string {
	const safe = value
		.replace(INVALID_XML_CHARS, "")
		.replace(/]]>/g, "]]]]><![CDATA[>");
	return `<![CDATA[${safe}]]>`;
}

const rfc822 = (iso: string) => new Date(iso).toUTCString();

const element = (name: string, text: string) =>
	`<${name}>${escapeXml(text)}</${name}>`;

function renderItem(item: RssItem): string {
	const parts = [
		item.title !== null ? element("title", item.title) : "",
		element("link", item.link),
		`<description>${item.descriptionIsHtml ? cdata(item.description) : escapeXml(item.description)}</description>`,
		item.content
			? `<content:encoded>${cdata(item.content)}</content:encoded>`
			: "",
		element("dc:creator", item.author),
		element("pubDate", rfc822(item.pubDate)),
		`<guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
		item.image
			? `<media:content url="${escapeXml(item.image.url)}" medium="image" type="${escapeXml(item.image.type)}"/>`
			: "",
	];
	return `<item>${parts.join("")}</item>`;
}

export function renderRss(
	channel: RssChannel,
	items: readonly RssItem[],
): string {
	const head = [
		element("title", channel.title),
		element("link", channel.link),
		element("description", channel.description),
		`<atom:link href="${escapeXml(channel.selfUrl)}" rel="self" type="application/rss+xml"/>`,
		channel.language ? element("language", channel.language) : "",
		channel.lastBuildDate
			? element("lastBuildDate", rfc822(channel.lastBuildDate))
			: "",
		element("docs", "https://www.rssboard.org/rss-specification"),
	];
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">',
		`<channel>${head.join("")}${items.map(renderItem).join("")}</channel>`,
		"</rss>",
	].join("\n");
}
