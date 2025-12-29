import crypto from "crypto";
import { env } from "~/env";

/**
 * Generate a secure URL with HMAC signature for photo access
 */
export function generateSecurePhotoUrl(
  filePath: string,
  userId: string,
  expUnix: number,
): string {
  const signature = generateUrlSignature(filePath, userId, expUnix);

  const params = new URLSearchParams({
    path: filePath,
    uid: userId,
    exp: expUnix.toString(),
    sig: signature,
  });

  return `/api/photos/serve?${params.toString()}`;
}

/**
 * Generate HMAC signature for URL validation
 */
function generateUrlSignature(
  filePath: string,
  userId: string,
  expUnix: number,
): string {
  const secret = env.PHOTO_URL_SECRET;
  return crypto
    .createHmac("sha256", secret)
    .update(`${filePath}:${userId}:${expUnix}`)
    .digest("hex");
}

/**
 * Validate secure URL signature and expiry
 */
export function validateSecureUrl(
  filePath: string,
  userId: string,
  exp: string,
  sig: string,
): { valid: boolean; error?: string } {
  try {
    const expUnix = Number.parseInt(exp);

    if (Number.isNaN(expUnix)) {
      return { valid: false, error: "Invalid expiry timestamp" };
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    if (nowUnix > expUnix) {
      return { valid: false, error: "URL has expired" };
    }

    const expectedSig = generateUrlSignature(filePath, userId, expUnix);

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
