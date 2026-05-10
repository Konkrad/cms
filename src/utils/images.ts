import { env } from "~/env";

/**
 * Derive the thumbnail S3 key from any main image S3 key.
 * Convention: {name}.webp → {name}-thumb.webp
 */
export function deriveThumbnailKey(mainKey: string): string {
  return mainKey.replace(/\.webp$/, "-thumb.webp");
}

const imageUrlConfig = {
  endpoint: env.AWS_ENDPOINT,
  bucket: env.S3_BUCKET,
  region: env.AWS_REGION,
} as const;

/**
 * Resolve a stored image key to a publicly accessible URL.
 */
export function publicImageUrlFromKey(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const normalizedKey = value.replace(/^\//, "");
  if (imageUrlConfig.endpoint) {
    return `${imageUrlConfig.endpoint.replace(/\/$/, "")}/${imageUrlConfig.bucket}/${normalizedKey}`;
  }

  return `https://${imageUrlConfig.bucket}.s3.${imageUrlConfig.region}.amazonaws.com/${normalizedKey}`;
}
