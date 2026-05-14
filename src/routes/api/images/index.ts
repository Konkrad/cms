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
import { env } from "~/env";
import crypto from "crypto";

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
    const uploadPrefix = uploadPathHeader
      ? uploadPathHeader.replace(/\/$/, "")
      : env.S3_UPLOAD_PATH;

    // Pipeline selection
    const pipelineName = (request.headers.get("x-pipeline") || "").trim() || "standard";
    let pipeline;
    try {
      pipeline = getPipeline(pipelineName);
    } catch (err) {
      throw error(400, err instanceof Error ? err.message : "Invalid pipeline");
    }

    const fileId = query.get("filename") || crypto.randomUUID();

    // SVG: upload raw, skip image processing
    if (pipelineName === "svg") {
      const contentType = request.headers.get("content-type") || "image/svg+xml";
      if (!contentType.includes("svg")) {
        throw error(400, "Expected SVG content type for svg pipeline");
      }
      const s3Key = `${uploadPrefix}/${fileId}.svg`;
      const result = await uploadRawFile(bodyStream, s3Key, "image/svg+xml");
      const accessUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${result.key}`
        : await generatePresignedGetUrl(result.key, 60 * 60);
      json(200, { success: true, filePath: result.key, url: accessUrl });
      return;
    }

    // Profile picture: 1000x1000 + 400x400 thumbnail, no DB write (action handles persistence)
    if (pipelineName === "profile-picture") {
      const { gallery: picture, thumbnail: pictureSmall } = await processAndUploadVariants(
        bodyStream,
        PROCESSING_PIPELINES.profilePicture,
        PROCESSING_PIPELINES.thumbnail,
        uploadPrefix,
        fileId,
      );

      // Access URLs
      const accessUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${picture.key}`
        : await generatePresignedGetUrl(picture.key, 60 * 60);

      json(200, {
        success: true,
        filePath: picture.key,
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
  const key = event.query.get("key")?.trim();

  if (key) {
    const normalizedKey = key.replace(/^\//, "");

    if (normalizedKey.startsWith("private/")) {
      const presignedUrl = await generatePresignedGetUrl(normalizedKey, 60 * 60);
      event.send(new Response(null, {
        status: 302,
        headers: { Location: presignedUrl },
      }));
      return;
    }

    const directUrl = env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${normalizedKey}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${normalizedKey}`;

    event.send(new Response(null, {
      status: 302,
      headers: { Location: directUrl },
    }));
    return;
  }

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
