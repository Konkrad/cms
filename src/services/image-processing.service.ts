/**
 * Image Processing Service
 *
 * Handles image transformations and uploads to S3 with streaming support.
 * Supports multiple processing pipelines for different use cases.
 */

import sharp from "sharp";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "stream";
import { Readable } from "stream";
import { env } from "~/env";

/**
 * Processing pipeline configuration
 */
export interface ImageProcessingPipeline {
  name: string;
  transform: (transformer: sharp.Sharp) => sharp.Sharp;
  outputFormat: "webp" | "jpeg" | "png";
  quality?: number;
}

/**
 * Available processing pipelines
 */
export const PROCESSING_PIPELINES = {
  // Standard web image - 1000x1000 webp with good quality
  standard: {
    name: "standard",
    transform: (transformer) =>
      transformer.resize(1000, 1000, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 80,
  },

  // Thumbnail - 300x300 webp for previews
  thumbnail: {
    name: "thumbnail",
    transform: (transformer) =>
      transformer.resize(300, 300, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 75,
  },

  // Hero image - 1920x1080 webp for banners/headers
  hero: {
    name: "hero",
    transform: (transformer) =>
      transformer.resize(1920, 1080, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 85,
  },

  // Original - minimal processing, just format conversion
  original: {
    name: "original",
    transform: (transformer) => transformer,
    outputFormat: "webp" as const,
    quality: 90,
  },
} satisfies Record<string, ImageProcessingPipeline>;

/**
 * Result of an image upload operation
 */
export interface ImageUploadResult {
  key: string;
  bucket: string;
  url: string;
  size?: number;
}

/**
 * Initialize S3 client with credentials from environment
 */
function createS3Client(): S3Client {
  // eslint-disable-next-line no-console
  console.log("Creating S3 Client with:", {
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT,
    bucket: env.S3_BUCKET,
    accessKeyId: env.AWS_ACCESS_KEY_ID
      ? `${env.AWS_ACCESS_KEY_ID.substring(0, 5)}...`
      : undefined,
  });

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
 * Process and upload an image stream to S3
 *
 * @param bodyStream - ReadableStream from the request body
 * @param pipeline - Processing pipeline to use
 * @param filename - Optional filename (will generate one if not provided)
 * @returns Upload result with S3 key and URL
 */
export async function processAndUploadImage(
  bodyStream: ReadableStream,
  pipeline: ImageProcessingPipeline = PROCESSING_PIPELINES.standard,
  filename?: string,
): Promise<ImageUploadResult> {
  // Generate filename if not provided
  const fileKey = filename || `${Date.now()}.${pipeline.outputFormat}`;
  const s3Key = `${env.S3_UPLOAD_PATH}/${fileKey}`;

  // Setup Sharp transformer based on pipeline
  const transformer = sharp();
  const transformedSharp = pipeline.transform(transformer);

  // Apply format and quality
  switch (pipeline.outputFormat) {
    case "webp":
      transformedSharp.webp({ quality: pipeline.quality || 80 });
      break;
    case "jpeg":
      transformedSharp.jpeg({ quality: pipeline.quality || 80 });
      break;
    case "png":
      transformedSharp.png({ quality: pipeline.quality || 80 });
      break;
  }

  // Create a PassThrough stream to bridge Sharp and S3
  const passThrough = new PassThrough();

  // Convert Web ReadableStream to Node.js Readable and pipe through Sharp
  const nodeReadable = Readable.fromWeb(bodyStream as any);
  nodeReadable.pipe(transformedSharp).pipe(passThrough);

  // Upload to S3
  const s3Client = createS3Client();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.S3_BUCKET,
      Key: s3Key,
      Body: passThrough,
      ContentType: `image/${pipeline.outputFormat}`,
    },
  });

  const result = await upload.done();

  // Construct the public URL (adjust based on your S3 configuration)
  const url = env.AWS_ENDPOINT
    ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${s3Key}`
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;

  return {
    key: s3Key,
    bucket: env.S3_BUCKET,
    url,
  };
}

/**
 * Get a processing pipeline by name
 */
export function getPipeline(name: string): ImageProcessingPipeline {
  const pipeline =
    PROCESSING_PIPELINES[name as keyof typeof PROCESSING_PIPELINES];
  if (!pipeline) {
    throw new Error(
      `Unknown pipeline: ${name}. Available: ${Object.keys(PROCESSING_PIPELINES).join(", ")}`,
    );
  }
  return pipeline;
}
