/**
 * S3 Presigned URL Utilities
 *
 * Replaces HMAC/signed-URL approach with AWS S3 presigned GET URLs.
 *
 * Usage:
 *  - Call `generateSecurePhotoUrl(filePath, userId, expUnix)` to get a presigned GET URL
 *    for the S3 object corresponding to `filePath` (e.g. `/private/events/{id}/photos/{photo}.webp`).
 *
 * Notes:
 *  - `userId` is accepted for compatibility with the previous signature API but is NOT used
 *    inside this function. Authorization checks (e.g., verifying the user is allowed to
 *    access the photo) must be performed by the caller (e.g., `photosService`) before
 *    requesting the presigned URL.
 *  - `expUnix` should be a UNIX timestamp in seconds. The function computes TTL as
 *    `expUnix - now` and uses it as `expiresIn` (in seconds) for the presigned URL.
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

/**
 * Create an S3 client using environment configuration.
 * We intentionally mirror the client construction used elsewhere so credentials/endpoint are consistent.
 */
function createS3Client(): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT,
    forcePathStyle: !!env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Generate a presigned GET URL for a given S3 key.
 * @param s3Key - the object key in the bucket (no leading slash)
 * @param expiresInSeconds - TTL in seconds for the presigned URL
 */
export async function generatePresignedGetUrl(
  s3Key: string,
  expiresInSeconds = 60 * 60, // default 1 hour
): Promise<string> {
  if (!s3Key) throw new Error("Missing s3 key");
  if (expiresInSeconds <= 0) throw new Error("expiresIn must be > 0");

  const client = createS3Client();
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: s3Key,
  });

  const url = await getSignedUrl(client, cmd, { expiresIn: expiresInSeconds });
  return url;
}

/**
 * Generate a secure (presigned) URL for a photo file path.
 *
 * @param filePath - stored logical file path, e.g. "/private/events/{eventId}/photos/{uuid}.webp"
 * @param _userId - (kept for compatibility) caller should verify user access before calling
 * @param expUnix - unix timestamp (seconds) when the URL should expire
 *
 * Returns a presigned S3 GET URL valid until `expUnix`.
 */
export async function generateSecurePhotoUrl(
  filePath: string,
  _userId: string,
  expUnix: number,
): Promise<string> {
  if (!filePath) {
    throw new Error("Missing filePath");
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  const expiresIn = expUnix - nowUnix;

  if (expiresIn <= 0) {
    throw new Error("Expiry must be in the future");
  }

  return generatePresignedGetUrl(filePath, expiresIn);
}

/**
 * Extract photo ID from file path
 * Example: /private/events/abc123/photos/photo-xyz789.webp -> photo-xyz789
 */
export function extractPhotoIdFromPath(filePath: string): string | null {
  const match = filePath.match(/\/photos\/([^/]+)\.\w+$/);
  return match ? match[1] : null;
}
