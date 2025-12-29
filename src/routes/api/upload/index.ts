import type { RequestHandler } from "@builder.io/qwik-city";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export const onPost: RequestHandler = async ({ request, json, send }) => {
  try {
    // Get upload path from headers (set by Uppy)
    const uploadPath = request.headers.get("x-upload-path");
    
    if (!uploadPath || !uploadPath.startsWith("/private/events/")) {
      json(400, { error: "Invalid upload path" });
      return;
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      json(400, { error: "No file provided" });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      json(400, { error: "Only image files are allowed" });
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      json(400, { error: "File size exceeds 10MB limit" });
      return;
    }

    // Generate unique filename
    const fileId = crypto.randomUUID();
    const ext = path.extname(file.name) || ".webp";
    const filename = `${fileId}${ext}`;
    
    // Construct full directory path
    const dirPath = path.join(process.cwd(), uploadPath.slice(1)); // Remove leading slash
    const filePath = path.join(dirPath, filename);

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true });

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Return file path relative to project root
    const relativeFilePath = `${uploadPath}${filename}`;

    json(200, {
      success: true,
      filePath: relativeFilePath,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    json(500, { error: "Upload failed" });
  }
};

