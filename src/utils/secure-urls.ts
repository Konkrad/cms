import crypto from "crypto";
import { env } from "~/env";

/**
 * Generate a secure URL with HMAC signature for photo access
 * URL expires in 1 hour by default
 */
export function generateSecurePhotoUrl(
  photoId: string,
  userId: string,
  filePath: string,
  expiryHours = 1,
): { url: string; expiresAt: string } {
  const expiryTime = Date.now() + expiryHours * 3600000;
  const signature = generateUrlSignature(photoId, userId, expiryTime);

  const params = new URLSearchParams({
    path: filePath,
    uid: userId,
    exp: expiryTime.toString(),
    sig: signature,
  });

  return {
    url: `/api/photos/serve?${params.toString()}`,
    expiresAt: new Date(expiryTime).toISOString(),
  };
}

/**
 * Generate HMAC signature for URL validation
 */
function generateUrlSignature(
  photoId: string,
  userId: string,
  expiryTime: number,
): string {
  const secret = env.PHOTO_URL_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(`${photoId}:${userId}:${expiryTime}`)
    .digest("hex");
}

/**
 * Validate secure URL signature and expiry
 */
export function validateSecureUrl(
  photoId: string,
  userId: string,
  exp: string,
  sig: string,
): { valid: boolean; error?: string } {
  try {
    const expiryTime = Number.parseInt(exp);

    if (Number.isNaN(expiryTime)) {
      return { valid: false, error: "Invalid expiry timestamp" };
    }

    if (Date.now() > expiryTime) {
      return { valid: false, error: "URL has expired" };
    }

    const expectedSig = generateUrlSignature(photoId, userId, expiryTime);

    const isValid = crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSig),
    );

    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Validation failed" };
  }
}

/**
 * Extract photo ID from file path
 * Example: /private/events/abc123/photos/photo-xyz789.webp -> photo-xyz789
 */
export function extractPhotoIdFromPath(filePath: string): string | null {
  const match = filePath.match(/\/photos\/([^/]+)\.\w+$/);
  return match ? match[1] : null;
}
