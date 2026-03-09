/**
 * Derive the 75×75 small variant key from a profile picture S3 key.
 * Profile pictures are stored as raw S3 keys (e.g. /uploads/profile-pictures/abc.webp).
 */
export function deriveProfilePicSmallKey(mainKey: string): string {
  return mainKey.replace(/\.webp$/, "_75x75.webp");
}

/**
 * Derive the 200×200 small variant URL from a full square image URL.
 * Used for events/groups/posts images stored as full public URLs.
 */
export function deriveSquareSmallUrl(mainUrl: string): string {
  return mainUrl.replace(/\.webp$/, "_200x200.webp");
}
