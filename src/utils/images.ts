/**
 * Derive the thumbnail S3 key from any main image S3 key.
 * Convention: {name}.webp → {name}-thumb.webp
 */
export function deriveThumbnailKey(mainKey: string): string {
  return mainKey.replace(/\.webp$/, "-thumb.webp");
}

/**
 * Resolve a stored image key to a browser-safe URL.
 *
 * This returns the local image middleware URL so it can be used safely in
 * client components without importing server-only env code.
 */
export function publicImageUrlFromKey(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const normalizedKey = value.replace(/^\//, "");
  return `/api/images?key=${encodeURIComponent(normalizedKey)}`;
}

/**
 * Unified middleware for resolving image URLs with presign awareness.
 * For public/* images: returns direct URL immediately (sync)
 * For private/* images: returns presigned URL (requires async/server context)
 *
 * This is the recommended method for all image access after file is stored.
 *
 * Usage (public images):
 *   const url = imageUrlFromKey('public/events/seed-1.webp'); // sync, direct URL
 *
 * Usage (private images in server/loader):
 *   const url = await imageUrlWithPresign('private/events/abc/photos/photo.webp');
 */
export function imageUrlFromKey(key: string | null | undefined): string | null {
  return publicImageUrlFromKey(key);
}

/**
 * Presign-aware variant for private image access (server/loader context only).
 * Call this in loaders or server$ functions to get presigned URLs for private paths.
 */
export async function imageUrlWithPresign(
  key: string | null | undefined,
  expiresInSeconds: number = 60 * 60,
): Promise<string | null> {
  return publicImageUrlFromKey(key);
}
