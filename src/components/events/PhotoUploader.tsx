import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  type Signal,
} from "@builder.io/qwik";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import { Button } from "~/components/ui/Button";

interface PhotoUploaderProps {
  eventId: string;
  onUploadSuccess?: (filePath: string) => void;
  onUploadError?: (error: string) => void;
}

export const PhotoUploader = component$<PhotoUploaderProps>(
  ({ eventId, onUploadSuccess, onUploadError }) => {
    const uppyRef = useSignal<Uppy | null>(null);
    const uploaderReady = useSignal(false);

    useVisibleTask$(({ cleanup }) => {
      // Initialize Uppy
      const uppy = new Uppy({
        restrictions: {
          maxFileSize: 10 * 1024 * 1024, // 10MB
          allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
          maxNumberOfFiles: 10,
        },
        autoProceed: false,
      });

      uppy.use(Dashboard, {
        inline: true,
        target: "#uppy-dashboard",
        height: 400,
        showProgressDetails: true,
        note: "Images only, up to 10MB each, max 10 files",
      });

      uppy.use(XHRUpload, {
        endpoint: "/api/upload",
        formData: true,
        fieldName: "file",
        headers: {
          "x-upload-path": `/private/events/${eventId}/photos/`,
        },
      });

      // Handle upload events
      uppy.on("upload-success", (file, response) => {
        const filePath = (response.body as any)?.filePath;
        if (filePath && onUploadSuccess) {
          onUploadSuccess(filePath);
        }
      });

      uppy.on("upload-error", (file, error) => {
        if (onUploadError) {
          onUploadError(error.message || "Upload failed");
        }
      });

      uppyRef.value = uppy;
      uploaderReady.value = true;

      cleanup(() => {
        uppy.close();
      });
    });

    return (
      <div class="space-y-4">
        <div class="border rounded-lg p-4 bg-white">
          <h3 class="text-lg font-semibold mb-4">Upload Event Photos</h3>
          
          <div id="uppy-dashboard"></div>

          <div class="mt-4 text-sm text-gray-600">
            <p class="font-medium">Upload Guidelines:</p>
            <ul class="mt-2 space-y-1 list-disc list-inside">
              <li>Only images (JPEG, PNG, WebP) are accepted</li>
              <li>Maximum file size: 10MB per image</li>
              <li>Photos will be optimized automatically</li>
              <li>Only attendees who were scanned can view photos</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
);
