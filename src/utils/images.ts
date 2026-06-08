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
 * Uses VITE_S3_BASE_URL (e.g. https://bucket.s3.region.amazonaws.com or
 * http://192.168.x.x:9000/bucket for local dev). Falls back to the
 * /api/images redirect if the env var is not configured.
 *
 * Only call this for public/* keys. Private keys must be presigned
 * server-side via resolvePrivateImageUrl in secure-urls.ts.
 */
export function publicImageUrlFromKey(
  value: string | null | undefined,
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

  const base: string | undefined = import.meta.env.VITE_S3_BASE_URL;
  const normalizedKey = value.replace(/^\//, "");

  return `${(base ?? "").replace(/\/$/, "")}/${normalizedKey}`;
}
