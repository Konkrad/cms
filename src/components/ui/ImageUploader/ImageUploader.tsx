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
import XHRUpload from "@uppy/xhr-upload";

import dashboardStyles from "@uppy/dashboard/css/style.css?inline";
import coreStyles from "@uppy/core/css/style.css?inline";

interface UploadedFileResponse {
  url?: string;
  filePath?: string;
}

interface ImageUploaderProps {
  /** Storage path prefix in S3 (e.g. 'public/events', 'public/profiles') */
  path: string;
  /** Processing pipeline — determines resize logic on the backend. Defaults to 'standard'. */
  pipeline?: "standard" | "gallery" | "thumbnail";
  /** Set to true to trigger the upload (e.g. on form submit). Required unless autoUpload is true. */
  triggerSignal?: Signal<boolean>;
  /** When true, shows the Uppy upload button and uploads immediately. No triggerSignal needed. */
  autoUpload?: boolean;
  /** Called when upload finishes (success or failure) or when there are no files to upload. Used with triggerSignal. */
  onSettled$?: QRL<() => void>;
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

  const containerRef = useSignal<Element>();
  const uppyRef = useSignal<NoSerialize<Uppy>>();
  const uploadedValues = useSignal<string[]>([]);
  const selectedPreviewUrl = useSignal<string | null>(null);

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
      })
      .use(XHRUpload, {
        endpoint: "/api/images",
        formData: false,
        headers: {
          "x-upload-path": props.path,
          "x-pipeline": props.pipeline ?? "standard",
        },
      });

    uppy.on("file-added", (file) => {
      const data = file.data;
      if (data instanceof Blob) {
        if (selectedPreviewUrl.value) {
          URL.revokeObjectURL(selectedPreviewUrl.value);
        }
        selectedPreviewUrl.value = URL.createObjectURL(data);
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
