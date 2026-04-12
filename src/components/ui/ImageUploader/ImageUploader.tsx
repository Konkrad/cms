import {
  component$,
  useSignal,
  useVisibleTask$,
  useStyles$,
  type PropFunction,
  type Signal,
  noSerialize,
  type NoSerialize,
} from "@builder.io/qwik";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import ImageEditor from "@uppy/image-editor";

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
  pipeline?: "standard" | "gallery" | "thumbnail";
  /** Set to true to trigger the upload (e.g. on form submit). Required unless autoUpload is true. */
  triggerSignal?: Signal<boolean>;
  /** When true, shows the Uppy upload button and uploads immediately. No triggerSignal needed. */
  autoUpload?: boolean;
  /** Called when upload finishes (success or failure) or when there are no files to upload. Used with triggerSignal. */
  onSettled$?: PropFunction<() => void>;
  /** Called for each successfully uploaded file with the API response. Useful in autoUpload mode. */
  onFileUploaded$?: PropFunction<(response: UploadedFileResponse) => void>;
  /** CSS aspect-ratio value for the widget (e.g. "16/9", "1/1", "4/3"). Defaults to "16/9". */
  aspectRatio?: string;
  /** HTML input name — emits hidden inputs so the form can read uploaded URLs */
  name?: string;
  /** Existing image URL to display in edit mode */
  currentUrl?: string;
}

export const ImageUploader = component$((props: ImageUploaderProps) => {
  useStyles$(coreStyles);
  useStyles$(dashboardStyles);
  useStyles$(imageEditorStyles);

  const containerRef = useSignal<Element>();
  const uppyRef = useSignal<NoSerialize<Uppy>>();
  const uploadedUrls = useSignal<string[]>([]);

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
      .use(ImageEditor, {
        target: Dashboard as any,
        quality: 0.8,
        cropperOptions: {
          viewMode: 1,
          background: false,
          autoCropArea: 1,
          responsive: true,
          aspectRatio: props.pipeline === "thumbnail" ? 1 : undefined,
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

      const urls = successful
        .map((f: any) => f.response?.body?.url)
        .filter(Boolean) as string[];

      if (urls.length > 0) {
        uploadedUrls.value = [...uploadedUrls.value, ...urls];
      }

      await props.onSettled$?.();
    });

    uppyRef.value = noSerialize(uppy);

    cleanup(() => uppy.destroy());
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
      {props.currentUrl && uploadedUrls.value.length === 0 && (
        <div class="mb-2 rounded border border-gray-200 overflow-hidden">
          <img
            src={props.currentUrl}
            alt="Current"
            class="w-full object-cover"
            style={{ aspectRatio: props.aspectRatio ?? "16/9" }}
          />
        </div>
      )}
      <div
        ref={containerRef}
        style={{ aspectRatio: props.aspectRatio ?? "16/9", width: "100%" }}
      />
      {/* Hidden inputs so the surrounding form can read the uploaded URLs */}
      {props.name && uploadedUrls.value.length > 0
        ? uploadedUrls.value.map((url, idx) => (
            <input
              key={String(idx)}
              type="hidden"
              name={props.name}
              value={url}
            />
          ))
        : props.name && props.currentUrl && (
            <input
              type="hidden"
              name={props.name}
              value={props.currentUrl}
            />
          )}
    </div>
  );
});
