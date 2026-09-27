/**
 * Derive the thumbnail S3 key from any main image S3 key.
 * Convention: {name}.webp → {name}-thumb.webp
 */
export function deriveThumbnailKey(mainKey: string): string {
	return mainKey.replace(/\.webp$/, "-thumb.webp");
}

/**
 * Resolve a stored S3 key to a direct browser-safe URL.
 *
 * `base` is env.S3_BASE_URL, resolved at runtime by the caller — never read
 * here directly, since this function runs both server-only and inside
 * client-executed component render bodies (the admin page builder's live
 * preview), and src/env.ts must never be bundled to the client. Server call
 * sites pass `env.S3_BASE_URL` directly; client call sites get it via the
 * `useS3BaseUrl()` root-layout loader (core code) or as a prop threaded down
 * from a core caller (theme code).
 *
 * Only call this for public/* keys. Private keys must be presigned
 * server-side via resolvePrivateImageUrl in secure-urls.ts.
 */
export function publicImageUrlFromKey(
	value: string | null | undefined,
	base: string,
): string | null {
	if (!value) return null;

	if (
		value.startsWith("http://") ||
		value.startsWith("https://") ||
		value.startsWith("blob:") ||
		value.startsWith("data:")
	) {
		return value;
	}

	const normalizedKey = value.replace(/^\//, "");

	return `${base.replace(/\/$/, "")}/${normalizedKey}`;
}
