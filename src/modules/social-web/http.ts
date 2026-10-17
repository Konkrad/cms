import { createHash } from "node:crypto";
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

export const ACTIVITY_JSON = "application/activity+json; charset=utf-8";
export const LD_JSON =
	'application/ld+json; profile="https://www.w3.org/ns/activitystreams"; charset=utf-8';

/**
 * The content type of an ActivityStreams answer: JSON-LD with the AS2 profile when the client
 * asks for that and not for `application/activity+json` (ActivityPub 3.2), else the latter.
 */
export function activityContentType(accept: string | null): string {
	const wantsLd = !!accept && /application\/ld\+json/i.test(accept);
	const wantsActivity = !!accept && /application\/activity\+json/i.test(accept);
	return wantsLd && !wantsActivity ? LD_JSON : ACTIVITY_JSON;
}

/** A strong ETag for a body (content addressed). */
export function bodyEtag(prefix: string, body: string): string {
	return `"${prefix}-${createHash("sha1").update(body).digest("base64url")}"`;
}

/**
 * Sends an ActivityStreams document (or a WebFinger JRD) built for this request, with an ETag
 * from its content, 304 answers and CORS open to everyone (public, read-only data).
 */
export async function sendJsonDocument(
	event: RequestEvent,
	document: unknown,
	options: {
		contentType: string;
		status?: number;
		lastModified?: string | null;
	},
): Promise<void> {
	const body = JSON.stringify(document);
	event.headers.set("Access-Control-Allow-Origin", "*");
	await sendCached(
		event,
		{
			etag: bodyEtag(
				options.contentType.startsWith("application/ld") ? "ld" : "as",
				body,
			),
			lastModified: options.lastModified ?? null,
		},
		async () => ({
			body,
			contentType: options.contentType,
			status: options.status,
		}),
		{ vary: "Accept" },
	);
}
