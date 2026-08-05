/**
 * Builds an absolute canonical URL from a site-relative pathname.
 *
 * Takes `origin` as a parameter (pass `url.origin` from a route's `head`
 * callback) rather than reading `env.APP_URL` itself — this file is reachable
 * from route `head` exports, and in Qwik's dev-mode client bundling, a
 * `~/env` import here has been observed to leak `src/env.ts` (which calls
 * `dotenv.config()`) into a client chunk, crashing with "process is not
 * defined" the first time that route's client module loads.
 */
export function canonicalUrl(pathname: string, origin: string): string {
	return new URL(pathname, origin).toString();
}

/** Strips HTML tags and collapses whitespace, then truncates to a meta-description-friendly length. */
export function htmlToDescription(
	html: string | null | undefined,
	maxLength = 155,
): string {
	const text = (html ?? "")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
