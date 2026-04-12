/**
 * Derive the thumbnail S3 key from any main image S3 key.
 * Convention: {name}.webp → {name}-thumb.webp
 */
export function deriveThumbnailKey(mainKey: string): string {
  return mainKey.replace(/\.webp$/, "-thumb.webp");
}
