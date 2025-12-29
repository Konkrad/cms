/**
 * Minimal ambient type declarations for '@aws-sdk/s3-request-presigner'
 *
 * This file provides a lightweight declaration for `getSignedUrl` sufficient
 * for our usage (creating presigned GET URLs for S3 objects).
 *
 * Keep this intentionally small and permissive (using `any`) to avoid coupling
 * to a specific version of the SDK's type definitions.
 */

declare module "@aws-sdk/s3-request-presigner" {
  /**
   * Options accepted by `getSignedUrl`.
   * - `expiresIn` is the TTL in seconds for the presigned URL.
   * - `signingRegion` is optional and may be provided by some SDK callers.
   */
  export interface GetSignedUrlOptions {
    expiresIn?: number;
    signingRegion?: string;
    // Additional options may exist depending on SDK versions, but we keep this minimal.
    [key: string]: any;
  }

  /**
   * Generate a presigned URL for a given client + command.
   *
   * - `client` is typically an instance of the S3 client (but typed as `any` here).
   * - `command` is typically an AWS SDK Command (e.g. `GetObjectCommand`).
   *
   * Returns a promise resolving to the presigned URL string.
   */
  export function getSignedUrl(
    client: any,
    command: any,
    options?: GetSignedUrlOptions
  ): Promise<string>;
}
