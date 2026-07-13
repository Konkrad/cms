/**
 * Image Upload API Endpoint (streaming-only)
 *
 * POST /api/images
 * - Expects a raw streaming file in the request body (no multipart). Use `x-upload-path` header
 *   to indicate the S3 key prefix (e.g. `private/events/{eventId}/photos`).
 * - Choose processing with `x-pipeline` header (e.g. `gallery`, `original`, `profile-picture`).
 *   If `pipeline=gallery` the server uploads a gallery variant AND also generates/uploads a thumbnail.
 *   For other pipelines only a single variant is produced.
 * - All outputs are converted to WebP.
 *
 * GET /api/images
 * - Returns available processing pipelines
 *
 * Returns:
 * - 200: JSON containing `filePath` and for private objects presigned URLs (or endpoint URL when configured)
 * - 400 / 403 / 500 accordingly
 */

import { type RequestHandler } from "@qwik.dev/router";
import {
  processAndUploadImage,
  processAndUploadVariants,
  getPipeline,
  PROCESSING_PIPELINES,
  uploadRawFile,
} from "~/services/image-processing.service";
import { generatePresignedGetUrl } from "~/utils/secure-urls";
import { requireAuth } from "~/utils/server-auth";
import { sanitizeSvg } from "~/utils/svg-sanitize";
import { env } from "~/env";
import crypto from "crypto";

/**
 * Storage roots an authenticated client is allowed to write to via the
 * `x-upload-path` header. The header is fully client-controlled, so without this
 * allowlist any logged-in user could write to arbitrary S3 keys (path traversal,
 * overwriting other objects, planting files in private prefixes).
 */
const ALLOWED_UPLOAD_PREFIXES = [
  "public/",
  "private/events/",
  "private/profile-pictures",
];

function sanitizeUploadPrefix(raw: string): string | null {
  const prefix = raw.replace(/\/$/, "");
  // Reject traversal, absolute paths, backslashes, and anything outside a safe charset.
  if (
    prefix.includes("..") ||
    prefix.startsWith("/") ||
    !/^[A-Za-z0-9._/-]+$/.test(prefix)
  ) {
    return null;
  }
  const allowed = ALLOWED_UPLOAD_PREFIXES.some(
    (root) => prefix === root.replace(/\/$/, "") || prefix.startsWith(root),
  );
  return allowed ? prefix : null;
}

/**
 * Authorize an upload destination per prefix. Authentication alone is not enough:
 * a plain member must not be able to write event-gallery or public content assets
 * (which are surfaced to other users through admin/representative-gated flows).
 *
 *  - profile-pictures → any authenticated user (their own avatar)
 *  - private/events/  → admin only (mirrors the event-photo create action)
 *  - public/* content → admin or a group representative
 */
async function isUploadAuthorized(
  prefix: string,
  user: { id: string; role?: string | null },
): Promise<boolean> {
  if (
    prefix.startsWith("private/profile-pictures") ||
    prefix.startsWith("public/profile-pictures")
  ) {
    return true;
  }

  const isStaff = user.role === "admin";
  if (prefix.startsWith("private/events/")) {
    return isStaff;
  }

  if (isStaff) return true;
  const { groupRepresentativesService } = await import(
    "~/services/group-representatives.service"
  );
  return groupRepresentativesService.isRepresentativeOfAny(user.id);
}

export const onPost: RequestHandler = async ({
  request,
  query,
  json,
  error,
  cookie,
  sharedMap,
  redirect,
}) => {
  // All image uploads require authentication
  const authEvent = { cookie, sharedMap, redirect } as any;
  const user = await requireAuth(authEvent);

  try {
    // Streaming-only uploads (no multipart): expect the raw file body to be the request body
    const bodyStream = request.body;
    if (!bodyStream) {
      throw error(400, "No file uploaded (expected streaming body)");
    }

    // Use provided upload path or fall back to configured S3 upload path
    const uploadPathHeader = (
      request.headers.get("x-upload-path") || ""
    ).trim();
    let uploadPrefix = env.S3_UPLOAD_PATH;
    if (uploadPathHeader) {
      const sanitized = sanitizeUploadPrefix(uploadPathHeader);
      if (!sanitized) {
        throw error(400, "Invalid upload path");
      }
      if (!(await isUploadAuthorized(sanitized, user))) {
        throw error(403, "Not authorized to upload to this location");
      }
      uploadPrefix = sanitized;
    }

    // Pipeline selection
    const pipelineName = (request.headers.get("x-pipeline") || "").trim() || "standard";
    let pipeline;
    try {
      pipeline = getPipeline(pipelineName);
    } catch (err) {
      throw error(400, err instanceof Error ? err.message : "Invalid pipeline");
    }

    const fileId = query.get("filename") || crypto.randomUUID();

    // SVG: sanitize then upload (no image processing)
    if (pipelineName === "svg") {
      const contentType = request.headers.get("content-type") || "image/svg+xml";
      if (!contentType.includes("svg")) {
        throw error(400, "Expected SVG content type for svg pipeline");
      }
      const raw = Buffer.from(await new Response(bodyStream).arrayBuffer()).toString("utf8");
      const safe = sanitizeSvg(raw);
      if (!safe.trim()) throw error(400, "Empty or invalid SVG after sanitization");
      const s3Key = `${uploadPrefix}/${fileId}.svg`;
      const result = await uploadRawFile(Buffer.from(safe, "utf8"), s3Key, "image/svg+xml");
      const accessUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${result.key}`
        : await generatePresignedGetUrl(result.key, 60 * 60);
      json(200, { success: true, filePath: result.key, url: accessUrl });
      return;
    }

    // Profile picture: main → private (presigned), thumbnail → public (direct URL)
    if (pipelineName === "profile-picture") {
      const { gallery: picture, thumbnail: pictureSmall } = await processAndUploadVariants(
        bodyStream,
        PROCESSING_PIPELINES.profilePicture,
        PROCESSING_PIPELINES.thumbnail,
        "private/profile-pictures",
        fileId,
        "public/profile-pictures",
      );

      const accessUrl = await generatePresignedGetUrl(picture.key, 60 * 60);

      json(200, {
        success: true,
        filePath: picture.key,
        thumbnailPath: pictureSmall.key,
        url: accessUrl,
      });
      return;
    }

    if (pipelineName === "gallery") {
      const { gallery, thumbnail } = await processAndUploadVariants(
        bodyStream,
        pipeline,
        PROCESSING_PIPELINES.thumbnail,
        uploadPrefix,
        fileId,
      );

      // Build access URL
      const galleryUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${gallery.key}`
        : await generatePresignedGetUrl(gallery.key, 60 * 60);

      json(200, {
        success: true,
        filePath: gallery.key,
        url: galleryUrl,
      });
      return;
    }

    // Single-variant pipeline
    const result = await processAndUploadImage(
      bodyStream,
      pipeline,
      `${uploadPrefix}/${fileId}.${pipeline.outputFormat}`,
    );

    // Decide access URL: use endpoint when available and object is not private; otherwise presign
    const isPrivate = uploadPrefix.includes("private");
    const accessUrl =
      env.AWS_ENDPOINT && !isPrivate
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${result.key}`
        : await generatePresignedGetUrl(result.key, 60 * 60);

    json(200, {
      success: true,
      filePath: result.key,
      url: accessUrl,
    });
    return;
  } catch (err) {
    console.error("images.onPost error:", err);
    json(500, { success: false, error: "Upload failed" });
  }
};

export const onGet: RequestHandler = async (event) => {
  const pipelines = Object.entries(PROCESSING_PIPELINES).map(
    ([key, pipeline]) => ({
      name: key,
      format: pipeline.outputFormat,
      quality: pipeline.quality,
    }),
  );

  event.json(200, {
    success: true,
    data: { pipelines },
  });
};
