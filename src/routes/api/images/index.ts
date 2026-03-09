/**
 * Image Upload API Endpoint (streaming-only)
 *
 * POST /api/images
 * - Expects a raw streaming file in the request body (no multipart). Use `x-upload-path` header
 *   to indicate the S3 key prefix (e.g. `private/events/{eventId}/photos`).
 * - Choose processing with `?pipeline=<name>`. If `pipeline=gallery` the server uploads a gallery
 *   variant AND also generates/uploads a thumbnail. For other pipelines only a single variant
 *   is produced.
 * - All outputs are converted to WebP.
 *
 * GET /api/images
 * - Returns available processing pipelines
 *
 * Returns:
 * - 200: JSON containing `filePath` and for private objects presigned URLs (or endpoint URL when configured)
 * - 400 / 403 / 500 accordingly
 */

import { type RequestHandler } from "@builder.io/qwik-city";
import {
  processAndUploadImage,
  processAndUploadVariants,
  processAndUploadSquareVariants,
  getPipeline,
  PROCESSING_PIPELINES,
} from "~/services/image-processing.service";
import { generatePresignedGetUrl } from "~/utils/secure-urls";
import { env } from "~/env";
import crypto from "crypto";

export const onPost: RequestHandler = async ({
  request,
  query,
  json,
  error,
}) => {
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
      ? uploadPathHeader.replace(/^\//, "").replace(/\/$/, "")
      : env.S3_UPLOAD_PATH;

    // Pipeline selection
    const pipelineName = query.get("pipeline") || "standard";
    let pipeline;
    try {
      pipeline = getPipeline(pipelineName);
    } catch (err) {
      throw error(400, err instanceof Error ? err.message : "Invalid pipeline");
    }

    const fileId = query.get("filename") || crypto.randomUUID();

    // If pipeline is 'gallery' create a gallery variant AND a thumbnail
    // If pipeline is 'square' create a 1000x1000 main + 200x200 small (derived by URL convention)
    if (pipelineName === "square") {
      // Read optional crop coordinates (ratio 0–1)
      const cropX = Number.parseFloat(request.headers.get("x-crop-x") || "");
      const cropY = Number.parseFloat(request.headers.get("x-crop-y") || "");
      const cropWidth = Number.parseFloat(request.headers.get("x-crop-width") || "");
      const cropHeight = Number.parseFloat(request.headers.get("x-crop-height") || "");

      const hasCrop =
        !Number.isNaN(cropX) &&
        !Number.isNaN(cropY) &&
        !Number.isNaN(cropWidth) &&
        !Number.isNaN(cropHeight) &&
        cropWidth > 0 &&
        cropHeight > 0;

      const { main } = await processAndUploadSquareVariants(
        bodyStream,
        uploadPrefix,
        fileId,
        hasCrop ? { x: cropX, y: cropY, width: cropWidth, height: cropHeight } : null,
      );

      const accessUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${main.key}`
        : await generatePresignedGetUrl(main.key, 60 * 60);

      json(200, {
        success: true,
        filePath: `/${main.key}`,
        url: accessUrl,
        s3: { main },
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

      // Build access URLs:
      // - Prefer a custom endpoint (env.AWS_ENDPOINT) if configured (never return raw amazonaws.com URL)
      // - Otherwise return presigned URLs (required for private/cloud defaults)
      const galleryUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${gallery.key}`
        : await generatePresignedGetUrl(gallery.key, 60 * 60);
      const thumbnailUrl = env.AWS_ENDPOINT
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${thumbnail.key}`
        : await generatePresignedGetUrl(thumbnail.key, 60 * 60);

      json(200, {
        success: true,
        filePath: `/${gallery.key}`,
        thumbnailPath: `/${thumbnail.key}`,
        urls: { gallery: galleryUrl, thumbnail: thumbnailUrl },
        s3: { gallery, thumbnail },
      });
      return;
    }

    // Single-variant pipeline
    const result = await processAndUploadImage(
      bodyStream,
      pipeline,
      `${fileId}.${pipeline.outputFormat}`,
    );

    // Decide access URL: use endpoint when available and object is not private; otherwise presign
    const isPrivate = uploadPrefix.includes("private");
    const accessUrl =
      env.AWS_ENDPOINT && !isPrivate
        ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${result.key}`
        : await generatePresignedGetUrl(result.key, 60 * 60);

    json(200, {
      success: true,
      filePath: `/${result.key}`,
      url: accessUrl,
      s3: result,
    });
    return;
  } catch (err) {
    console.error("images.onPost error:", err);
    json(500, { success: false, error: "Upload failed" });
  }
};

export const onGet: RequestHandler = async ({ json }) => {
  const pipelines = Object.entries(PROCESSING_PIPELINES).map(
    ([key, pipeline]) => ({
      name: key,
      format: pipeline.outputFormat,
      quality: pipeline.quality,
    }),
  );

  json(200, {
    success: true,
    data: { pipelines },
  });
};
