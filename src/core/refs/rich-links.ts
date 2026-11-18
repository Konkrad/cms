import { isRefHref, REF_SCHEME } from "./refs";

/**
 * References inside stored HTML and page-builder data (spec 4.3). Stored HTML has passed
 * `sanitizeRichHtml`, so every attribute is double-quoted and these regular expressions see
 * normalized markup. Pure (the server functions that resolve live in `~/core/registry/refs`).
 */

const REF_ANCHOR_RE =
	/<a\b([^>]*?)\shref="(ref:[^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_RE = /(<a\b[^>]*?\shref=")([^"]*)(")/gi;

const escapeAttr = (value: string) =>
	value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The `ref:` hrefs in an HTML string, in document order (duplicates removed). */
export function collectRefHrefs(html: string): string[] {
	return [...new Set([...html.matchAll(REF_ANCHOR_RE)].map((m) => m[2]))];
}

/**
 * Rewrite the `ref:` hrefs of an HTML string to the URLs in `urls` (keyed by the href,
 * `ref:` included). A link whose reference does not resolve (missing or null) is dropped
 * and its text kept.
 */
export function rewriteRefLinks(
	html: string,
	urls: ReadonlyMap<string, string | null>,
): string {
	return html.replace(
		REF_ANCHOR_RE,
		(_, before: string, href: string, after: string, inner: string) => {
			const url = urls.get(href);
			return url
				? `<a${before} href="${escapeAttr(url)}"${after}>${inner}</a>`
				: inner;
		},
	);
}

/** The hrefs of every link in an HTML string (to find internal ones to turn into refs). */
export function collectHrefs(html: string): string[] {
	return [...new Set([...html.matchAll(HREF_RE)].map((m) => m[2]))];
}

/** Replace hrefs by the values in `replacements` (keyed by the old href); others stay. */
export function replaceHrefs(
	html: string,
	replacements: ReadonlyMap<string, string>,
): string {
	return html.replace(
		HREF_RE,
		(match, start: string, href: string, end: string) => {
			const next = replacements.get(href);
			return next === undefined ? match : `${start}${escapeAttr(next)}${end}`;
		},
	);
}

/** Every `ref:` value in page-builder data: link fields holding one and hrefs in HTML fields. */
export function collectBlockRefs(value: unknown): string[] {
	const found = new Set<string>();
	const walk = (v: unknown) => {
		if (typeof v === "string") {
			if (isRefHref(v)) found.add(v.trim());
			else if (v.includes(`href="${REF_SCHEME}`))
				for (const href of collectRefHrefs(v)) found.add(href);
		} else if (Array.isArray(v)) v.forEach(walk);
		else if (v && typeof v === "object") Object.values(v).forEach(walk);
	};
	walk(value);
	return [...found];
}

/**
 * Page-builder data with every reference replaced by its current URL: a link field holding
 * an unavailable reference becomes "" (the block renders no link), and HTML fields go
 * through `rewriteRefLinks`.
 */
export function rewriteBlockRefs<T>(
	value: T,
	urls: ReadonlyMap<string, string | null>,
): T {
	const walk = (v: unknown): unknown => {
		if (typeof v === "string") {
			if (isRefHref(v)) return urls.get(v.trim()) ?? "";
			return v.includes(`href="${REF_SCHEME}`) ? rewriteRefLinks(v, urls) : v;
		}
		if (Array.isArray(v)) return v.map(walk);
		if (v && typeof v === "object")
			return Object.fromEntries(
				Object.entries(v).map(([k, inner]) => [k, walk(inner)]),
			);
		return v;
	};
	return walk(value) as T;
}
