import type { RequestHandler } from "@builder.io/qwik-city";
import { validateSecureUrl } from "~/utils/secure-urls";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const onGet: RequestHandler = async ({ url, json, send }) => {
  try {
    const filePath = url.searchParams.get("path");
    const userId = url.searchParams.get("uid");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");

    // Validate required parameters
    if (!filePath || !userId || !exp || !sig) {
      json(400, { error: "Missing required parameters" });
      return;
    }

    // Validate file path format
    if (!filePath.startsWith("/private/events/") || !filePath.endsWith(".webp")) {
      json(400, { error: "Invalid file path" });
      return;
    }

    // Validate signature and expiry
    const validation = validateSecureUrl(filePath, userId, exp, sig);
    if (!validation.valid) {
      json(403, { error: validation.error || "Invalid or expired URL" });
      return;
    }

    // Check for path traversal attempts
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith("/private/events/")) {
      json(403, { error: "Invalid file path" });
      return;
    }

    // Construct full file path (relative to project root)
    const fullPath = path.join(process.cwd(), normalizedPath.slice(1)); // Remove leading slash

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      json(404, { error: "Photo not found" });
      return;
    }

    // Read file
    const fileBuffer = await fs.readFile(fullPath);

    // Generate ETag for caching
    const etag = crypto
      .createHash("md5")
      .update(fileBuffer)
      .digest("hex");

    // Check if client has cached version
    const ifNoneMatch = url.searchParams.get("if-none-match");
    if (ifNoneMatch === etag) {
      send(
        new Response(null, {
          status: 304,
        })
      );
      return;
    }

    // Send file with appropriate headers
    send(
      new Response(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=3600", // 1 hour cache
          "ETag": etag,
          "Content-Length": fileBuffer.length.toString(),
        },
      })
    );
  } catch (error) {
    console.error("Error serving photo:", error);
    json(500, { error: "Internal server error" });
  }
};

