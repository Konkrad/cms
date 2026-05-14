/**
 * Server-safe SVG sanitizer (no DOM required).
 *
 * Strips the most common SVG-based XSS vectors:
 *  - XML declaration / DOCTYPE
 *  - <script> elements
 *  - event-handler attributes (on*)
 *  - javascript: URLs in href / xlink:href / src
 *  - <foreignObject> (can embed arbitrary HTML)
 *  - <use> referencing external URLs
 *
 * Returns the sanitized <svg>…</svg> string, or an empty string if the
 * input does not contain a valid SVG element.
 */
export function sanitizeSvg(raw: string): string {
  // Extract the outermost <svg>…</svg> element (strips XML declarations, DOCTYPE, comments)
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return "";

  let svg = match[0];

  // Remove <script> elements and their content
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");

  // Remove event-handler attributes (on*)
  svg = svg.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "");
  svg = svg.replace(/\s+on[a-z]+\s*=[^\s>]*/gi, "");

  // Replace javascript: in href, xlink:href and src with #
  svg = svg.replace(/(href|xlink:href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '$1="#"');

  // Remove <foreignObject> (can embed HTML)
  svg = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");

  // Remove <use> elements that reference external resources
  svg = svg.replace(/<use[^>]*(href|xlink:href)\s*=\s*["'][a-z]+:\/\/[^"']*["'][^>]*\/?>/gi, "");

  return svg.trim();
}
