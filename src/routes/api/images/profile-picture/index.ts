/**
 * Profile Picture Upload API Endpoint
 *
 * POST /api/images/profile-picture
 * - Expects a raw image in the request body (streaming, no multipart).
 * - Crop coordinates are passed as headers (ratios 0–1 relative to the natural image dimensions):
 *     x-crop-x, x-crop-y, x-crop-width, x-crop-height
 * - Produces two variants:
 *     - 400×400 (profile picture)
 *     - 75×75  (small / navigation avatar)
 * - Updates the user record with the S3 keys.
 *
 * Returns:
 *   200: { success, profilePicture, profilePictureSmall, urls }
 *   400 / 401 / 500 accordingly
 */

import type { RequestHandler } from "@builder.io/qwik-city";
import { processAndUploadProfilePicture } from "~/services/image-processing.service";
import { requireAuth } from "~/utils/server-auth";
import { db } from "~/db/connection";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export const onPost: RequestHandler = async ({
  request,
  json,
  cookie,
  sharedMap,
  redirect,
  error,
}) => {
  // Authenticate – build a minimal event-like object for requireAuth
  const event = { cookie, sharedMap, redirect } as any;
  const user = await requireAuth(event);

  const bodyStream = request.body;
  if (!bodyStream) {
    throw error(400, "No file uploaded (expected streaming body)");
  }

  // Parse crop coordinates from headers (ratios 0–1)
  const cropX = Number.parseFloat(request.headers.get("x-crop-x") || "0");
  const cropY = Number.parseFloat(request.headers.get("x-crop-y") || "0");
  const cropWidth = Number.parseFloat(
    request.headers.get("x-crop-width") || "1",
  );
  const cropHeight = Number.parseFloat(
    request.headers.get("x-crop-height") || "1",
  );

  // Basic validation
  for (const [name, val] of [
    ["x-crop-x", cropX],
    ["x-crop-y", cropY],
    ["x-crop-width", cropWidth],
    ["x-crop-height", cropHeight],
  ] as const) {
    if (Number.isNaN(val) || val < 0 || val > 1) {
      throw error(400, `Invalid crop coordinate ${name}: must be between 0 and 1`);
    }
  }

  if (cropWidth <= 0 || cropHeight <= 0) {
    throw error(400, "Crop width and height must be greater than 0");
  }

  const { picture, pictureSmall } = await processAndUploadProfilePicture(
    bodyStream,
    { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
    user.id,
  );

  // Persist S3 keys on the user record
  await db
    .update(users)
    .set({
      profilePicture: `/${picture.key}`,
      profilePictureSmall: `/${pictureSmall.key}`,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id));

  json(200, {
    success: true,
    profilePicture: `/${picture.key}`,
    profilePictureSmall: `/${pictureSmall.key}`,
    urls: {
      picture: picture.url,
      pictureSmall: pictureSmall.url,
    },
  });
};
