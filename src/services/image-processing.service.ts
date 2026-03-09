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

  // Profile picture - 400x400 square crop
  profilePicture: {
    name: "profilePicture",
    transform: (transformer) =>
      transformer.rotate().resize(400, 400, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 85,
  },

  // Profile picture small - 75x75 square crop
  profilePictureSmall: {
    name: "profilePictureSmall",
    transform: (transformer) =>
      transformer.rotate().resize(75, 75, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 80,
  },

  // Square - 1000x1000 square crop for event/group/post featured images
  square: {
    name: "square",
    transform: (transformer) =>
      transformer.resize(1000, 1000, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 80,
  },

  // Square small - 200x200 thumbnail variant for square images
  squareSmall: {
    name: "squareSmall",
    transform: (transformer) =>
      transformer.resize(200, 200, {
        fit: "cover",
        position: "entropy",
      }),
    outputFormat: "webp" as const,
    quality: 80,
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
 * Crop coordinates as ratios (0–1) relative to the natural image dimensions.
 */
export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Process and upload a profile picture to S3 producing a 400×400 and a 75×75 variant.
 *
 * The caller supplies crop coordinates (ratios 0–1) that describe the square
 * region the user selected on the frontend.  The function:
 *   1. Buffers the incoming stream
 *   2. Auto-rotates based on EXIF orientation
 *   3. Extracts the crop region (converted from ratios → pixels)
 *   4. Resizes to 400×400 and 75×75
 *   5. Uploads both variants to S3
 *
 * @returns S3 keys and URLs for both variants
 */
export async function processAndUploadProfilePicture(
  input: ReadableStream | Buffer,
  crop: CropCoordinates,
  userId: string,
): Promise<{ picture: ImageUploadResult; pictureSmall: ImageUploadResult }> {
  // Always buffer so we can read metadata and branch into two pipelines
  let buffer: Buffer;
  if (input instanceof Buffer) {
    buffer = input;
  } else {
    const nodeReadable = Readable.fromWeb(input as any);
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReadable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  }

  // Auto-rotate first, then read metadata so dimensions reflect the true orientation
  const rotated = await sharp(buffer)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const { width: imgWidth, height: imgHeight } = rotated.info;

  // Convert ratio-based crop coordinates to pixel values
  const extractLeft = Math.round(crop.x * imgWidth);
  const extractTop = Math.round(crop.y * imgHeight);
  const extractWidth = Math.min(
    Math.round(crop.width * imgWidth),
    imgWidth - extractLeft,
  );
  const extractHeight = Math.min(
    Math.round(crop.height * imgHeight),
    imgHeight - extractTop,
  );

  const s3Client = createS3Client();
  const keyPrefix = `${env.S3_UPLOAD_PATH}/profile-pictures`;
  const pictureKey = `${keyPrefix}/${userId}.webp`;
  const pictureSmallKey = `${keyPrefix}/${userId}_75x75.webp`;

  // Process 400×400 variant
  const picBuffer = await sharp(rotated.data)
    .extract({
      left: extractLeft,
      top: extractTop,
      width: extractWidth,
      height: extractHeight,
    })
    .resize(400, 400, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();

  // Process 75×75 variant
  const picSmallBuffer = await sharp(rotated.data)
    .extract({
      left: extractLeft,
      top: extractTop,
      width: extractWidth,
      height: extractHeight,
    })
    .resize(75, 75, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();

  // Upload both concurrently
  const [_picResult, _picSmallResult] = await Promise.all([
    new Upload({
      client: s3Client,
      params: {
        Bucket: env.S3_BUCKET,
        Key: pictureKey,
        Body: picBuffer,
        ContentType: "image/webp",
      },
    }).done(),
    new Upload({
      client: s3Client,
      params: {
        Bucket: env.S3_BUCKET,
        Key: pictureSmallKey,
        Body: picSmallBuffer,
        ContentType: "image/webp",
      },
    }).done(),
  ]);

  const buildUrl = (key: string) =>
    env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    picture: {
      key: pictureKey,
      bucket: env.S3_BUCKET,
      url: buildUrl(pictureKey),
    },
    pictureSmall: {
      key: pictureSmallKey,
      bucket: env.S3_BUCKET,
      url: buildUrl(pictureSmallKey),
    },
  };
}

/**
 * Process and upload a square image producing a 1000×1000 main variant and a
 * 200×200 small variant. The small variant is stored at `{fileId}_200x200.webp`
 * alongside the main `{fileId}.webp` — clients derive the small URL by
 * convention without it being stored in the database.
 *
 * When `crop` is provided (ratio-based coordinates 0–1), the crop region is
 * extracted first before resizing, giving the user full control over framing.
 */
export async function processAndUploadSquareVariants(
  input: ReadableStream | Buffer,
  keyPrefix: string,
  fileId?: string,
  crop?: CropCoordinates | null,
): Promise<{ main: ImageUploadResult; small: ImageUploadResult }> {
  const id = fileId || `${Date.now()}`;
  const mainKey = `${keyPrefix}/${id}.webp`;
  const smallKey = `${keyPrefix}/${id}_200x200.webp`;

  // Buffer the input so we can process two variants from the same data
  let buffer: Buffer;
  if (input instanceof Buffer) {
    buffer = input;
  } else {
    const nodeReadable = Readable.fromWeb(input as any);
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReadable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    buffer = Buffer.concat(chunks);
  }

  // Auto-rotate so dimensions reflect true orientation, then optionally crop
  const rotated = await sharp(buffer)
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const { width: imgWidth, height: imgHeight } = rotated.info;

  let sourceBuffer: Buffer = rotated.data;
  if (crop) {
    const extractLeft = Math.round(crop.x * imgWidth);
    const extractTop = Math.round(crop.y * imgHeight);
    const extractWidth = Math.min(
      Math.round(crop.width * imgWidth),
      imgWidth - extractLeft,
    );
    const extractHeight = Math.min(
      Math.round(crop.height * imgHeight),
      imgHeight - extractTop,
    );
    sourceBuffer = await sharp(rotated.data)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: extractWidth,
        height: extractHeight,
      })
      .toBuffer();
  }

  const s3Client = createS3Client();

  function uploadBufferWithPipeline(
    buf: Buffer,
    pipeline: ImageProcessingPipeline,
    s3Key: string,
  ) {
    const transformer = sharp(buf);
    const transformed = pipeline.transform(transformer);
    transformed.webp({ quality: pipeline.quality || 80 });

    const passThrough = new PassThrough();
    transformed.pipe(passThrough);

    return new Upload({
      client: s3Client,
      params: {
        Bucket: env.S3_BUCKET,
        Key: s3Key,
        Body: passThrough,
        ContentType: "image/webp",
      },
    }).done();
  }

  await Promise.all([
    uploadBufferWithPipeline(sourceBuffer, PROCESSING_PIPELINES.square, mainKey),
    uploadBufferWithPipeline(sourceBuffer, PROCESSING_PIPELINES.squareSmall, smallKey),
  ]);

  const buildUrl = (key: string) =>
    env.AWS_ENDPOINT
      ? `${env.AWS_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    main: { key: mainKey, bucket: env.S3_BUCKET, url: buildUrl(mainKey) },
    small: { key: smallKey, bucket: env.S3_BUCKET, url: buildUrl(smallKey) },
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
