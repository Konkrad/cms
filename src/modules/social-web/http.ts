import type { RequestEvent } from "@qwik.dev/router";

/** HTTP caching validators of a response (RFC 9110 conditional requests). */
export interface Validators {
	/** Strong entity tag, with its quotes. */
	etag: string;
	/** ISO timestamp of the newest change, or null when unknown. */
	lastModified: string | null;
}

/** How long shared caches and readers may reuse a response before revalidating it. */
export const MAX_AGE_SECONDS = 300;

/**
 * Whether the request's validators match (`If-None-Match` wins over `If-Modified-Since`, as in
 * RFC 9110 13.2.2), so the answer is 304 Not Modified.
 */
export function isNotModified(
	headers: Headers,
	validators: Validators,
): boolean {
	const ifNoneMatch = headers.get("if-none-match");
	if (ifNoneMatch !== null) {
		return ifNoneMatch
			.split(",")
			.map((tag) => tag.trim().replace(/^W\//, ""))
			.some((tag) => tag === "*" || tag === validators.etag);
	}
	const ifModifiedSince = headers.get("if-modified-since");
	if (ifModifiedSince && validators.lastModified) {
		const since = Date.parse(ifModifiedSince);
		const modified = Date.parse(validators.lastModified);
		// HTTP dates have whole seconds.
		return (
			!Number.isNaN(since) &&
			Math.floor(modified / 1000) <= Math.floor(since / 1000)
		);
	}
	return false;
}

/**
 * Answers a GET with caching headers: 304 without a body when the request's validators still
 * match, else the body `build` returns (built only then). `vary` names request headers the
 * representation depends on (e.g. Accept).
 */
export async function sendCached(
	event: RequestEvent,
	validators: Validators,
	build: () => Promise<{ body: string; contentType: string; status?: number }>,
	options: { vary?: string } = {},
): Promise<void> {
	const { headers } = event;
	headers.set("ETag", validators.etag);
	if (validators.lastModified)
		headers.set(
			"Last-Modified",
			new Date(validators.lastModified).toUTCString(),
		);
	headers.set(
		"Cache-Control",
		`public, max-age=${MAX_AGE_SECONDS}, must-revalidate`,
	);
	if (options.vary) headers.set("Vary", options.vary);
	if (isNotModified(event.request.headers, validators)) {
		event.send(304, "");
		return;
	}
	const response = await build();
	headers.set("Content-Type", response.contentType);
	event.send(response.status ?? 200, response.body);
}
