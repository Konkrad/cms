/**
 * Image Upload API Endpoint
 *
 * POST /api/images
 * Accepts image uploads in any format and processes them using the specified pipeline.
 * Streams the image through Sharp for processing and directly to S3.
 *
 * Query Parameters:
 * - pipeline: string (optional) - Name of the processing pipeline to use (default: 'standard')
 *   Available: 'standard', 'thumbnail', 'hero', 'original'
 * - filename: string (optional) - Custom filename for the uploaded image
 *
 * Returns:
 * - 200: { success: true, data: { key, bucket, url } }
 * - 400: { success: false, error: string }
 * - 500: { success: false, error: string }
 */

import { type RequestHandler } from '@builder.io/qwik-city';
import {
  processAndUploadImage,
  getPipeline,
  PROCESSING_PIPELINES,
} from '~/services/image-processing.service';

export const onPost: RequestHandler = async ({ request, query, json, error }) => {
  const bodyStream = request.body;

  if (!bodyStream) {
    throw error(400, 'No file uploaded');
  }

  // Get pipeline from query params or use default
  const pipelineName = query.get('pipeline') || 'standard';
  const customFilename = query.get('filename') || undefined;

  // Validate and get the pipeline
  let pipeline;
  try {
    pipeline = getPipeline(pipelineName);
  } catch (err) {
    throw error(400, err instanceof Error ? err.message : 'Invalid pipeline');
  }

  // Process and upload the image
  const result = await processAndUploadImage(
    bodyStream,
    pipeline,
    customFilename
  );

  json(200, {
    success: true,
    data: result,
  });
};

/**
 * GET /api/images
 * Returns available processing pipelines
 */
export const onGet: RequestHandler = async ({ json }) => {
  const pipelines = Object.entries(PROCESSING_PIPELINES).map(([key, pipeline]) => ({
    name: key,
    format: pipeline.outputFormat,
    quality: pipeline.quality,
  }));

  json(200, {
    success: true,
    data: { pipelines },
  });
};
