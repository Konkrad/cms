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

  // Gallery - web-optimized (scale down if needed), used for event gallery images
  gallery: {
    name: "gallery",
    transform: (transformer) =>
      transformer.resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      }),
    outputFormat: "webp" as const,
    quality: 85,
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

  // Output format: always webp
  transformedSharp.webp({ quality: pipeline.quality || 80 });

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
 * Process and upload an image buffer/stream to S3 producing both a gallery and thumbnail variant.
 *
 * Attempts to stream the pipeline and upload both variants concurrently.
 * Falls back to buffering the input if the environment doesn't support tee() on web streams.
 */
export async function processAndUploadVariants(
  input: ReadableStream | Buffer,
  galleryPipeline: ImageProcessingPipeline = PROCESSING_PIPELINES.gallery,
  thumbnailPipeline: ImageProcessingPipeline = PROCESSING_PIPELINES.thumbnail,
  keyPrefix: string,
  fileId?: string,
): Promise<{ gallery: ImageUploadResult; thumbnail: ImageUploadResult }> {
  const id = fileId || `${Date.now()}`;
  const galleryFileName = `${id}.${galleryPipeline.outputFormat}`;
  const thumbFileName = `${id}-thumb.${thumbnailPipeline.outputFormat}`;
  const galleryS3Key = `${keyPrefix}/${galleryFileName}`;
  const thumbS3Key = `${keyPrefix}/${thumbFileName}`;

  const s3Client = createS3Client();

  function uploadFromReadable(
    nodeReadable: Readable,
    pipeline: ImageProcessingPipeline,
    s3Key: string,
  ) {
    const transformer = sharp();
    const transformed = pipeline.transform(transformer);

    // Output format: always webp
    transformed.webp({ quality: pipeline.quality || 80 });

    const passThrough = new PassThrough();
    nodeReadable.pipe(transformed).pipe(passThrough);

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: env.S3_BUCKET,
        Key: s3Key,
        Body: passThrough,
        ContentType: `image/webp`,
      },
    });

    return upload.done();
  }

  let galleryUploadPromise: Promise<any>;
  let thumbUploadPromise: Promise<any>;

  if (input instanceof Buffer) {
    const nodeA = Readable.from(input);
    const nodeB = Readable.from(input);

    galleryUploadPromise = uploadFromReadable(
      nodeA,
      galleryPipeline,
      galleryS3Key,
    );
    thumbUploadPromise = uploadFromReadable(
      nodeB,
      thumbnailPipeline,
      thumbS3Key,
    );
  } else {
    const webStream = input as ReadableStream;

    // Require tee() to be available for streaming split; no fallback buffering.
    if (typeof (webStream as any).tee !== "function") {
      throw new Error(
        "Streaming environment does not support ReadableStream.tee(); cannot split stream",
      );
    }

    const [sA, sB] = (webStream as any).tee();
    const nodeA = Readable.fromWeb(sA as any);
    const nodeB = Readable.fromWeb(sB as any);

    galleryUploadPromise = uploadFromReadable(
      nodeA,
      galleryPipeline,
      galleryS3Key,
    );
    thumbUploadPromise = uploadFromReadable(
      nodeB,
      thumbnailPipeline,
      thumbS3Key,
    );
  }

  const [galleryResult, thumbResult] = await Promise.all([
    galleryUploadPromise,
    thumbUploadPromise,
  ]);

  const galleryUrl = env.AWS_ENDPOINT
    ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${galleryS3Key}`
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${galleryS3Key}`;

  const thumbUrl = env.AWS_ENDPOINT
    ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${thumbS3Key}`
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${thumbS3Key}`;

  return {
    gallery: {
      key: galleryS3Key,
      bucket: env.S3_BUCKET,
      url: galleryUrl,
    },
    thumbnail: {
      key: thumbS3Key,
      bucket: env.S3_BUCKET,
      url: thumbUrl,
    },
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
