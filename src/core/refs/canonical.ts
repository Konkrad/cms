import type { RequestEventCommon } from "@qwik.dev/router";

/**
 * Every item has one canonical URL under its owning scope (spec 4.3). Reached under another
 * scope prefix (the root included: `/events/<id>`), its page answers 301 to that URL.
 */

const trimSlash = (path: string) => path.replace(/\/+$/, "") || "/";

/**
 * Where to redirect a request for `pathname` whose canonical location is `canonical`, or null
 * when it is already there. A trailing slash and percent-encoding do not count as different.
 */
export function canonicalRedirect(
	pathname: string,
	canonical: string,
): string | null {
	const decode = (p: string) => {
		try {
			return decodeURIComponent(p);
		} catch {
			return p;
		}
	};
	return decode(trimSlash(pathname)) === decode(trimSlash(canonical))
		? null
		: canonical;
}

/**
 * Throws a 301 to `canonical` (query string kept) unless the request URL is already the
 * canonical one. Call in a page `load` after its auth and visibility checks, so a viewer who
 * may not see the item gets the same 404 at every URL.
 */
export function requireCanonicalUrl(
	event: Pick<RequestEventCommon, "url" | "redirect">,
	canonical: string,
): void {
	const target = canonicalRedirect(event.url.pathname, canonical);
	if (!target) return;
	const query = new URLSearchParams(event.url.search);
	// Qwik's own request parameters never belong to the page URL.
	for (const key of ["qaction", "qdata", "qfunc"]) query.delete(key);
	const search = query.toString();
	throw event.redirect(301, search ? `${target}?${search}` : target);
}
