import sanitizeHtml from "sanitize-html";
import { EXTERNAL_LINK_RE, isRefHref, parseRef } from "~/core/refs/refs";

/**
 * Sanitizes rich-text HTML produced by the BlockNote editor before it is stored
 * and later rendered with `dangerouslySetInnerHTML` (jobs, posts).
 *
 * The editor emits HTML on the client, but `body` is submitted via a plain hidden
 * input, so the value is fully attacker-controlled — it must be sanitized
 * server-side on write. The allowlist covers the formatting tags BlockNote
 * produces (headings, lists, inline marks, links, code, tables) and drops
 * everything else, including `<script>`, event handlers, and `javascript:` URLs.
 *
 * Links (spec 4.3): only internal references (`ref:<reference>`, rewritten to the current
 * URL when rendering, see `renderRichHtml`) and external `http(s):`, `mailto:` and `tel:`
 * URLs are kept. Any other link (`javascript:`, `data:`, a relative or protocol-relative
 * path, a malformed reference) loses its link and keeps its text: links to pages of this
 * site are turned into references before this runs (`internalLinksToRefs`), so a remaining
 * relative path points to nothing the site can keep track of. External links open in a new
 * tab with `rel="noopener noreferrer nofollow"`; reference links stay in the tab.
 */
export function sanitizeRichHtml(dirty: string): string {
	return sanitizeHtml(dirty, {
		allowedTags: [
			"p",
			"br",
			"span",
			"div",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"ul",
			"ol",
			"li",
			"blockquote",
			"pre",
			"code",
			"strong",
			"b",
			"em",
			"i",
			"u",
			"s",
			"strike",
			"del",
			"mark",
			"a",
			"table",
			"thead",
			"tbody",
			"tr",
			"th",
			"td",
			"hr",
		],
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
			span: ["data-text-color", "data-background-color"],
			"*": ["data-text-alignment"],
		},
		allowedSchemes: ["http", "https", "mailto", "tel", "ref"],
		allowProtocolRelative: false,
		transformTags: {
			a: (_tagName, attribs): sanitizeHtml.Tag => {
				const href = (attribs.href ?? "").trim();
				if (isRefHref(href) && parseRef(href)) {
					return { tagName: "a", attribs: { href } };
				}
				if (EXTERNAL_LINK_RE.test(href)) {
					return {
						tagName: "a",
						attribs: {
							href,
							...(attribs.title ? { title: attribs.title } : {}),
							rel: "noopener noreferrer nofollow",
							target: "_blank",
						},
					};
				}
				// Not a link the site keeps: the text stays, the link goes.
				const none: sanitizeHtml.Attributes = {};
				return { tagName: "span", attribs: none };
			},
		},
		disallowedTagsMode: "discard",
	});
}
