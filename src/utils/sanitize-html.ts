import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes rich-text HTML produced by the BlockNote editor before it is stored
 * and later rendered with `dangerouslySetInnerHTML` (jobs, posts).
 *
 * The editor emits HTML on the client, but `body` is submitted via a plain hidden
 * input, so the value is fully attacker-controlled — it must be sanitized
 * server-side on write. The allowlist covers the formatting tags BlockNote
 * produces (headings, lists, inline marks, links, code, tables) and drops
 * everything else, including `<script>`, event handlers, and `javascript:` URLs.
 */
export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "p", "br", "span", "div",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "strong", "b", "em", "i", "u", "s", "strike", "del", "mark",
      "a",
      "table", "thead", "tbody", "tr", "th", "td",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      span: ["data-text-color", "data-background-color"],
      "*": ["data-text-alignment"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Force safe link behavior; drops javascript:/data: URLs via allowedSchemes.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
    disallowedTagsMode: "discard",
  });
}
