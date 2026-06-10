/**
 * Image Processing Service
 *
 * Handles image transformations and uploads to S3 with streaming support.
 * Supports multiple processing pipelines for different use cases.
 */

import sharp from "sharp";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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
  // Standard web image - 1000x1000 webp with good quality (keeps proportions)
  standard: {
    name: "standard",
    transform: (transformer) =>
      transformer.resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
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

  // Thumbnail - 400x400 webp square entropy crop for previews (Grid, Avatars)
  thumbnail: {
    name: "thumbnail",
    transform: (transformer) =>
      transformer.resize(400, 400, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 75,
  },

  // Profile picture - 1000x1000 proportional (expects cropped blob)
  profilePicture: {
    name: "profilePicture",
    transform: (transformer) =>
      transformer.resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
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
 */
export async function processAndUploadImage(
  bodyStream: ReadableStream | Buffer,
  pipeline: ImageProcessingPipeline = PROCESSING_PIPELINES.standard,
  filename?: string,
): Promise<ImageUploadResult> {
  const fileKey = filename || `${Date.now()}.${pipeline.outputFormat}`;
  const s3Key = fileKey.includes("/") ? fileKey : `${env.S3_UPLOAD_PATH}/${fileKey}`;

  const transformer = sharp();
  const transformedSharp = pipeline.transform(transformer);
  transformedSharp.webp({ quality: pipeline.quality || 80 });

  const passThrough = new PassThrough();
  const nodeReadable = bodyStream instanceof Buffer 
    ? Readable.from(bodyStream) 
    : Readable.fromWeb(bodyStream as any);
    
  nodeReadable.pipe(transformedSharp).pipe(passThrough);

  const s3Client = createS3Client();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.S3_BUCKET,
      Key: s3Key,
      Body: passThrough,
      ContentType: `image/webp`,
    },
  });

  await upload.done();

  const url = env.AWS_ENDPOINT
    ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${s3Key}`
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;

  return { key: s3Key, bucket: env.S3_BUCKET, url };
}

/**
 * Process and upload an imageProducing both a main and thumbnail variant.
 */
export async function processAndUploadVariants(
  input: ReadableStream | Buffer,
  mainPipeline: ImageProcessingPipeline,
  thumbPipeline: ImageProcessingPipeline = PROCESSING_PIPELINES.thumbnail,
  keyPrefix: string,
  fileId?: string,
  thumbKeyPrefix?: string,
): Promise<{ gallery: ImageUploadResult; thumbnail: ImageUploadResult }> {
  const id = fileId || `${Date.now()}`;
  const mainS3Key = `${keyPrefix}/${id}.webp`;
  const thumbS3Key = `${thumbKeyPrefix ?? keyPrefix}/${id}-thumb.webp`;

  const s3Client = createS3Client();

  async function uploadVariant(
    nodeReadable: Readable,
    pipeline: ImageProcessingPipeline,
    s3Key: string,
  ) {
    const transformer = sharp();
    const transformed = pipeline.transform(transformer);
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

  // Buffer the stream to allow both variants to read the same data independently.
  // Using tee() can cause issues with some ReadableStream implementations in Vite's dev server.
  let buffer: Buffer;
  if (input instanceof Buffer) {
    buffer = input;
  } else {
    const chunks: Uint8Array[] = [];
    const reader = (input as ReadableStream<Uint8Array>).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    buffer = Buffer.concat(chunks);
  }

  const mainNode = Readable.from(buffer);
  const thumbNode = Readable.from(buffer);

  const [mainResult, thumbResult] = await Promise.all([
    uploadVariant(mainNode, mainPipeline, mainS3Key),
    uploadVariant(thumbNode, thumbPipeline, thumbS3Key),
  ]);

  const buildUrl = (key: string) => env.AWS_ENDPOINT
    ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    gallery: { key: mainS3Key, bucket: env.S3_BUCKET, url: buildUrl(mainS3Key) },
    thumbnail: { key: thumbS3Key, bucket: env.S3_BUCKET, url: buildUrl(thumbS3Key) },
  };
}

export function getPipeline(name: string): ImageProcessingPipeline {
  // Support kebab-case names as aliases for camelCase keys (e.g. "profile-picture" → "profilePicture")
  const camelName = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const pipeline = (PROCESSING_PIPELINES as any)[name] ?? (PROCESSING_PIPELINES as any)[camelName];
  if (!pipeline) throw new Error(`Pipeline ${name} not found`);
  return pipeline;
}

export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const s3Client = createS3Client();
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: env.S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}

/**
 * Upload a raw file to S3 without any processing (e.g. SVG files).
 */
export async function uploadRawFile(
  bodyStream: ReadableStream | Buffer,
  s3Key: string,
  contentType: string,
): Promise<ImageUploadResult> {
  const s3Client = createS3Client();
  const nodeReadable =
    bodyStream instanceof Buffer
      ? Readable.from(bodyStream)
      : Readable.fromWeb(bodyStream as any);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.S3_BUCKET,
      Key: s3Key,
      Body: nodeReadable,
      ContentType: contentType,
    },
  });

  await upload.done();

  const url = env.AWS_ENDPOINT
    ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${s3Key}`
    : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${s3Key}`;

  return { key: s3Key, bucket: env.S3_BUCKET, url };
}
