import {
  component$,
  useSignal,
  useVisibleTask$,
  useStyles$,
  type QRL,
  type Signal,
  noSerialize,
  type NoSerialize,
} from "@qwik.dev/core";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import ImageEditor from "@uppy/image-editor";
import XHRUpload from "@uppy/xhr-upload";

import dashboardStyles from "@uppy/dashboard/css/style.css?inline";
import coreStyles from "@uppy/core/css/style.css?inline";
import imageEditorStyles from "@uppy/image-editor/css/style.css?inline";

interface UploadedFileResponse {
  url?: string;
  filePath?: string;
}

interface ImageUploaderProps {
  /** Storage path prefix in S3 (e.g. 'public/events', 'public/profiles') */
  path: string;
  /** Processing pipeline — determines resize logic on the backend. Defaults to 'standard'. */
  pipeline?: "standard" | "gallery" | "thumbnail" | "profile-picture";
  /** Set to true to trigger the upload (e.g. on form submit). Required unless autoUpload is true. */
  triggerSignal?: Signal<boolean>;
  /** When true, shows the Uppy upload button and uploads immediately. No triggerSignal needed. */
  autoUpload?: boolean;
  /** Called when upload finishes (success or failure) or when there are no files to upload. Used with triggerSignal. */
  onSettled$?: QRL<() => void>;
  /** When true, opens a crop editor for selected images before upload. */
  crop?: boolean;
  /** Fixed crop ratio expressed as width/height, e.g. "3/4" for portrait. */
  cropAspectRatio?: string;
  /** Called immediately when a file is selected, with its blob URL for preview. */
  onFileSelected$?: QRL<(blobUrl: string) => void>;
  /** Called for each successfully uploaded file with the API response. Useful in autoUpload mode. */
  onFileUploaded$?: QRL<(response: UploadedFileResponse) => void>;
  /** CSS aspect-ratio value for the widget (e.g. "16/9", "1/1", "4/3"). Defaults to "16/9". */
  aspectRatio?: string;
  /** HTML input name — emits hidden inputs so the form can read uploaded URLs */
  name?: string;
  /** Existing image URL for preview in edit forms. */
  currentUrl?: string;
  /** Existing stored key/value to keep when no new upload is selected. */
  currentValue?: string;
}

export const ImageUploader = component$((props: ImageUploaderProps) => {
  useStyles$(coreStyles);
  useStyles$(dashboardStyles);
  useStyles$(imageEditorStyles);

  const containerRef = useSignal<Element>();
  const uppyRef = useSignal<NoSerialize<Uppy>>();
  const uploadedValues = useSignal<string[]>([]);
  const selectedPreviewUrl = useSignal<string | null>(null);

  const cropAspectRatio = props.cropAspectRatio
    ? (() => {
        const [width, height] = props.cropAspectRatio.split("/").map(Number);
        return width > 0 && height > 0 ? width / height : undefined;
      })()
    : undefined;

  // Initialise Uppy once the widget container is visible in the DOM.
  useVisibleTask$(({ cleanup }) => {
    // Compute pixel height from the container's current width + aspectRatio
    const [aw, ah] = (props.aspectRatio ?? "16/9").split("/").map(Number);
    const containerWidth = (containerRef.value as HTMLElement)?.clientWidth ?? 600;
    const computedHeight = Math.round(containerWidth * (ah / aw));

    const uppy = new Uppy({
      debug: false,
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: props.pipeline === "gallery" ? 20 : 1,
        allowedFileTypes: ["image/*"],
      },
    })
      .use(Dashboard, {
        inline: true,
        target: containerRef.value as HTMLElement,
        width: "100%",
        height: computedHeight,
        hideProgressDetails: false,
        hideUploadButton: !props.autoUpload,
        proudlyDisplayPoweredByUppy: false,
        autoOpen: props.crop ? "imageEditor" : undefined,
        plugins: props.crop ? ["ImageEditor"] : undefined,
      })
      .use(ImageEditor, {
        target: Dashboard as any,
        quality: 1,
        cropperOptions: {
          aspectRatio: cropAspectRatio,
          viewMode: 1,
          background: false,
          autoCropArea: 1,
          responsive: true,
        },
        actions: {
          revert: true,
          rotate: true,
          granularRotate: true,
          flip: true,
          zoomIn: true,
          zoomOut: true,
          cropSquare: false,
          cropWidescreen: false,
          cropWidescreenVertical: false,
        },
      })
      .use(XHRUpload, {
        endpoint: "/api/images",
        formData: false,
        headers: {
          "x-upload-path": props.path,
          "x-pipeline": props.pipeline ?? "standard",
        },
      });

    const updatePreview = (blob: Blob) => {
      if (selectedPreviewUrl.value) {
        URL.revokeObjectURL(selectedPreviewUrl.value);
      }
      selectedPreviewUrl.value = URL.createObjectURL(blob);
      props.onFileSelected$?.(selectedPreviewUrl.value);
    };

    // For live crop preview updates, we'll use a polling approach
    // that checks the file state while the image editor is open
    let cropPollInterval: NodeJS.Timeout | null = null;
    let lastCropUpdateTime = 0;

    uppy.on("file-added", (file) => {
      const data = file.data;
      if (data instanceof Blob) {
        updatePreview(data);
      }

      // Start polling for crop updates if crop is enabled
      if (props.crop && !cropPollInterval) {
        cropPollInterval = setInterval(() => {
          // Check if image editor is active by looking for the editor UI in the DOM
          const editorUI = document.querySelector('[data-testid="editor-view"]') ||
                          document.querySelector('.uppy-ImageEditor-editor');
          
          if (!editorUI) {
            // Editor is not active, stop polling
            if (cropPollInterval) {
              clearInterval(cropPollInterval);
              cropPollInterval = null;
            }
            return;
          }

          // Try to access the cropper through the uppy instance
          const imageEditorPlugin = uppy.getPlugin("ImageEditor");
          if (!imageEditorPlugin) return;

          const pluginState = (imageEditorPlugin as any);
          
          // The cropper instance might be in different locations depending on Uppy version
          // Check common locations
          const cropper = pluginState.cropper || 
                         (pluginState as any).cropper_ ||
                         (imageEditorPlugin as any).cropper;

          if (cropper && typeof cropper.getCroppedCanvas === 'function') {
            try {
              const now = Date.now();
              // Rate limit updates to avoid excessive blob creation
              if (now - lastCropUpdateTime > 100) {
                const canvas = cropper.getCroppedCanvas();
                canvas.toBlob((blob: Blob) => {
                  if (blob) {
                    updatePreview(blob);
                  }
                }, "image/webp", 0.95);
                lastCropUpdateTime = now;
              }
            } catch (_err) {
              // Ignore errors during live crop updates
            }
          }
        }, 50); // Poll every 50ms for smooth updates
      }
    });

    uppy.on("file-editor:complete", (updatedFile) => {
      const data = updatedFile.data;
      if (data instanceof Blob) {
        updatePreview(data);
      }
      // Stop polling when crop is complete
      if (cropPollInterval) {
        clearInterval(cropPollInterval);
        cropPollInterval = null;
      }
    });

    uppy.on("file-removed", () => {
      if (selectedPreviewUrl.value) {
        URL.revokeObjectURL(selectedPreviewUrl.value);
        selectedPreviewUrl.value = null;
      }
    });

    // Per-file callback — useful for gallery/auto-upload mode
    uppy.on("upload-success", (_file, response) => {
      const body = (response as any).body ?? {};
      props.onFileUploaded$?.({
        url: body.url,
        filePath: body.filePath,
      });
    });

    // Handle completion inline — avoids QRL-as-callback issues
    uppy.on("complete", async (result) => {
      const successful = result.successful ?? [];

      const values = successful
        .map((f: any) => f.response?.body?.filePath || f.response?.body?.url)
        .filter(Boolean) as string[];

      if (values.length > 0) {
        uploadedValues.value = [...uploadedValues.value, ...values];
      }

      // Wait for Qwik to reconcile the DOM (hidden inputs) before notifying
      await new Promise((r) => requestAnimationFrame(r));
      await props.onSettled$?.();
    });

    uppyRef.value = noSerialize(uppy);

    cleanup(() => {
      if (selectedPreviewUrl.value) {
        URL.revokeObjectURL(selectedPreviewUrl.value);
      }
      uppy.destroy();
    });
  });

  // Watch the trigger signal and kick off the upload when it flips to true.
  useVisibleTask$(({ track }) => {
    if (!props.triggerSignal) return;
    const shouldTrigger = track(() => props.triggerSignal!.value);
    if (shouldTrigger && uppyRef.value) {
      const uppy = uppyRef.value;
      const fileCount = uppy.getFiles().length;
      if (fileCount === 0) {
        // No files selected — treat as settled so the form can still submit
        void props.onSettled$?.();
      } else {
        uppy.upload();
      }
    }
  });

  return (
    <div class="w-full">
      {(selectedPreviewUrl.value || props.currentUrl) && uploadedValues.value.length === 0 && (
        <div class="mb-3 rounded border border-gray-200 overflow-hidden">
          <img
            src={selectedPreviewUrl.value ?? props.currentUrl ?? undefined}
            alt={selectedPreviewUrl.value ? "Selected image preview" : "Current image"}
            class="w-full h-auto object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          aspectRatio: props.aspectRatio ?? "16/9",
          width: "100%",
        }}
      />
      {/* Hidden inputs so the surrounding form can read uploaded keys */}
      {props.name && uploadedValues.value.length > 0 &&
        uploadedValues.value.map((value, idx) => (
          <input
            key={String(idx)}
            type="hidden"
            name={props.name}
            value={value}
          />
        ))}

      {props.name && uploadedValues.value.length === 0 && props.currentValue && (
        <input type="hidden" name={props.name} value={props.currentValue} />
      )}
    </div>
  );
});
