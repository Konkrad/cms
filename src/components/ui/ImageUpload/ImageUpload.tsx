import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useStore,
  type QRL,
} from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";

interface CropState {
  x: number;
  y: number;
  size: number;
}

interface ImageUploadProps {
  name: string;
  label: string;
  currentImageUrl?: string | null;
  uploadPath?: string;
  pipeline?: string;
  crop?: boolean;
  previewShape?: "square" | "circle";
  onUploadComplete$?: QRL<(urls: Record<string, string>) => void>;
}

export const ImageUpload = component$<ImageUploadProps>(
  ({
    name,
    label,
    currentImageUrl,
    uploadPath = "public/",
    pipeline = "square",
    crop: cropEnabled,
    previewShape = "square",
    onUploadComplete$,
  }) => {
    const showCrop =
      cropEnabled !== undefined
        ? cropEnabled
        : pipeline === "square" || pipeline === "profile-picture";

    const fileInputRef = useSignal<HTMLInputElement>();
    const imageRef = useSignal<HTMLImageElement>();
    const containerRef = useSignal<HTMLDivElement>();

    const imageDataUrl = useSignal<string | null>(null);
    const uploading = useSignal(false);
    const uploadError = useSignal<string | null>(null);
    const uploadSuccess = useSignal(false);
    const savedUrl = useSignal<string>(currentImageUrl ?? "");

    const displayWidth = useSignal(0);
    const displayHeight = useSignal(0);
    const imageOffsetX = useSignal(0);

    const crop = useStore<CropState>({ x: 0, y: 0, size: 100 });

    const dragging = useSignal<"move" | "nw" | "ne" | "sw" | "se" | null>(
      null,
    );
    const dragStart = useStore({
      mouseX: 0,
      mouseY: 0,
      cropX: 0,
      cropY: 0,
      cropSize: 0,
    });

    const computeDisplayDimensions = $(() => {
      const img = imageRef.value;
      const container = containerRef.value;
      if (!img || !container) return;

      const containerWidth = container.clientWidth;
      const maxHeight = 400;

      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) return;

      const aspect = nw / nh;
      let dw = containerWidth;
      let dh = containerWidth / aspect;
      if (dh > maxHeight) {
        dh = maxHeight;
        dw = maxHeight * aspect;
      }

      displayWidth.value = dw;
      displayHeight.value = dh;
      imageOffsetX.value = (containerWidth - dw) / 2;

      const minDim = Math.min(dw, dh);
      crop.size = minDim * 0.8;
      crop.x = (dw - crop.size) / 2;
      crop.y = (dh - crop.size) / 2;
    });

    const onFileSelect = $((e: Event) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      uploadSuccess.value = false;
      uploadError.value = null;

      if (showCrop) {
        const reader = new FileReader();
        reader.onload = () => {
          imageDataUrl.value = reader.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        uploadSimple(file);
      }
    });

    const uploadSimple = $(async (file: File) => {
      uploading.value = true;
      uploadError.value = null;

      const prefix = uploadPath.replace(/^\//, "").replace(/\/$/, "");
      const fileId = globalThis.crypto.randomUUID();

      const response = await fetch(
        `/api/images?pipeline=${pipeline}&filename=${encodeURIComponent(fileId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": file.type,
            "x-upload-path": prefix,
          },
          body: file,
        },
      );

      const result = await response.json();
      uploading.value = false;

      if (!response.ok || !result.success) {
        uploadError.value = result.error || "Upload failed";
        return;
      }

      savedUrl.value = result.url ?? result.filePath ?? "";
      uploadSuccess.value = true;

      if (onUploadComplete$) {
        await onUploadComplete$(result.urls ?? { url: savedUrl.value });
      }
    });

    useVisibleTask$(({ track, cleanup }) => {
      track(() => imageDataUrl.value);

      const img = imageRef.value;
      if (!img) return;

      const handler = () => computeDisplayDimensions();
      img.addEventListener("load", handler);
      cleanup(() => img.removeEventListener("load", handler));
    });

    const onPointerMove = $((e: PointerEvent) => {
      if (!dragging.value) return;
      e.preventDefault();

      const dx = e.clientX - dragStart.mouseX;
      const dy = e.clientY - dragStart.mouseY;
      const dw = displayWidth.value;
      const dh = displayHeight.value;

      if (dragging.value === "move") {
        let newX = dragStart.cropX + dx;
        let newY = dragStart.cropY + dy;
        const size = crop.size;
        newX = Math.max(0, Math.min(newX, dw - size));
        newY = Math.max(0, Math.min(newY, dh - size));
        crop.x = newX;
        crop.y = newY;
      } else {
        let newSize = dragStart.cropSize;
        let newX = dragStart.cropX;
        let newY = dragStart.cropY;
        const handle = dragging.value;
        let delta = 0;

        if (handle === "se") {
          delta = Math.max(dx, dy);
          newSize = dragStart.cropSize + delta;
        } else if (handle === "sw") {
          delta = Math.max(-dx, dy);
          newSize = dragStart.cropSize + delta;
          newX = dragStart.cropX - delta;
        } else if (handle === "ne") {
          delta = Math.max(dx, -dy);
          newSize = dragStart.cropSize + delta;
          newY = dragStart.cropY - delta;
        } else if (handle === "nw") {
          delta = Math.max(-dx, -dy);
          newSize = dragStart.cropSize + delta;
          newX = dragStart.cropX - delta;
          newY = dragStart.cropY - delta;
        }

        const minSize = 40;
        if (newSize < minSize) {
          const diff = minSize - newSize;
          newSize = minSize;
          if (handle === "sw" || handle === "nw") newX -= diff;
          if (handle === "ne" || handle === "nw") newY -= diff;
        }

        if (newX < 0) {
          newSize += newX;
          newX = 0;
        }
        if (newY < 0) {
          newSize += newY;
          newY = 0;
        }
        if (newX + newSize > dw) {
          newSize = dw - newX;
        }
        if (newY + newSize > dh) {
          newSize = dh - newY;
        }

        const maxPossible = Math.min(dw - newX, dh - newY);
        newSize = Math.min(newSize, maxPossible);
        newSize = Math.max(newSize, minSize);

        crop.x = newX;
        crop.y = newY;
        crop.size = newSize;
      }
    });

    const onPointerUp = $(() => {
      dragging.value = null;
    });

    const startDrag = $(
      (e: PointerEvent, handle: "move" | "nw" | "ne" | "sw" | "se") => {
        e.preventDefault();
        e.stopPropagation();
        dragging.value = handle;
        dragStart.mouseX = e.clientX;
        dragStart.mouseY = e.clientY;
        dragStart.cropX = crop.x;
        dragStart.cropY = crop.y;
        dragStart.cropSize = crop.size;
      },
    );

    const uploadCropped = $(async () => {
      const dataUrl = imageDataUrl.value;
      if (!dataUrl) return;

      uploading.value = true;
      uploadError.value = null;
      uploadSuccess.value = false;

      const dw = displayWidth.value;
      const dh = displayHeight.value;
      if (!dw || !dh) {
        uploadError.value = "Image dimensions not available";
        uploading.value = false;
        return;
      }

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const cropRatioX = crop.x / dw;
      const cropRatioY = crop.y / dh;
      const cropRatioW = crop.size / dw;
      const cropRatioH = crop.size / dh;

      const cropHeaders: Record<string, string> = {
        "x-crop-x": cropRatioX.toFixed(6),
        "x-crop-y": cropRatioY.toFixed(6),
        "x-crop-width": cropRatioW.toFixed(6),
        "x-crop-height": cropRatioH.toFixed(6),
      };

      let url: string;
      if (pipeline === "profile-picture") {
        url = "/api/images/profile-picture";
      } else {
        const fileId = globalThis.crypto.randomUUID();
        const prefix = uploadPath.replace(/^\//, "").replace(/\/$/, "");
        url = `/api/images?pipeline=${pipeline}&filename=${encodeURIComponent(fileId)}`;
        cropHeaders["x-upload-path"] = prefix;
      }

      const response = await fetch(url, {
        method: "POST",
        body: blob,
        headers: {
          "Content-Type": blob.type,
          ...cropHeaders,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        uploadError.value = result.error || "Upload failed";
        uploading.value = false;
        return;
      }

      savedUrl.value = result.url ?? result.filePath ?? result.profilePicture ?? "";
      uploading.value = false;
      uploadSuccess.value = true;
      imageDataUrl.value = null;

      if (onUploadComplete$) {
        await onUploadComplete$(result.urls ?? { url: savedUrl.value });
      }
    });

    const removeSelection = $(() => {
      imageDataUrl.value = null;
      uploadSuccess.value = false;
      uploadError.value = null;
      if (fileInputRef.value) {
        fileInputRef.value.value = "";
      }
    });

    const previewRounded =
      previewShape === "circle" ? "rounded-full" : "rounded-lg";

    return (
      <div class="space-y-4">
        <label class="text-sm font-medium text-text block">{label}</label>

        {/* Current image preview */}
        {!imageDataUrl.value && savedUrl.value && (
          <div class="flex items-center gap-4">
            <img
              src={savedUrl.value}
              alt="Current image"
              width={80}
              height={80}
              class={`w-20 h-20 object-cover border-2 border-gray-200 ${previewRounded}`}
            />
            <span class="text-sm text-gray-500">Current image</span>
          </div>
        )}

        {/* Drop zone */}
        {!imageDataUrl.value && !uploading.value && (
          <div
            class="border-2 border-dashed border-border-strong rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick$={() => fileInputRef.value?.click()}
          >
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <p class="mt-2 text-sm text-gray-600">Click to select a photo</p>
            <p class="mt-1 text-xs text-gray-400">
              JPG, PNG or WebP.
              {showCrop && " You'll be able to crop it to a square."}
            </p>
          </div>
        )}

        {/* Simple upload loading state */}
        {!showCrop && uploading.value && (
          <p class="text-sm text-blue-600">Uploading...</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          onChange$={onFileSelect}
        />

        {/* Crop UI */}
        {showCrop && imageDataUrl.value && (
          <div class="space-y-3">
            <p class="text-sm text-gray-600">
              Drag the square to select the area. Drag corners to resize.
            </p>
            <div
              ref={containerRef}
              class="relative select-none overflow-hidden bg-gray-100 rounded-lg"
              style={{
                height: `${displayHeight.value || 400}px`,
                touchAction: "none",
              }}
              onPointerMove$={onPointerMove}
              onPointerUp$={onPointerUp}
              onPointerLeave$={onPointerUp}
            >
              <img
                ref={imageRef}
                src={imageDataUrl.value}
                alt="Crop preview"
                class="block"
                style={{
                  width: `${displayWidth.value}px`,
                  height: `${displayHeight.value}px`,
                  marginLeft: `${imageOffsetX.value}px`,
                }}
                draggable={false}
              />

              {displayWidth.value > 0 && (
                <>
                  {/* Top overlay */}
                  <div
                    class="absolute bg-black/50 pointer-events-none"
                    style={{
                      left: `${imageOffsetX.value}px`,
                      top: "0",
                      width: `${displayWidth.value}px`,
                      height: `${crop.y}px`,
                    }}
                  />
                  {/* Bottom overlay */}
                  <div
                    class="absolute bg-black/50 pointer-events-none"
                    style={{
                      left: `${imageOffsetX.value}px`,
                      top: `${crop.y + crop.size}px`,
                      width: `${displayWidth.value}px`,
                      height: `${displayHeight.value - crop.y - crop.size}px`,
                    }}
                  />
                  {/* Left overlay */}
                  <div
                    class="absolute bg-black/50 pointer-events-none"
                    style={{
                      left: `${imageOffsetX.value}px`,
                      top: `${crop.y}px`,
                      width: `${crop.x}px`,
                      height: `${crop.size}px`,
                    }}
                  />
                  {/* Right overlay */}
                  <div
                    class="absolute bg-black/50 pointer-events-none"
                    style={{
                      left: `${imageOffsetX.value + crop.x + crop.size}px`,
                      top: `${crop.y}px`,
                      width: `${displayWidth.value - crop.x - crop.size}px`,
                      height: `${crop.size}px`,
                    }}
                  />

                  {/* Crop box + move handle */}
                  <div
                    class="absolute border-2 border-white cursor-move"
                    style={{
                      left: `${imageOffsetX.value + crop.x}px`,
                      top: `${crop.y}px`,
                      width: `${crop.size}px`,
                      height: `${crop.size}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "move")}
                  >
                    {/* Rule-of-thirds grid */}
                    <div class="absolute inset-0 pointer-events-none">
                      <div
                        class="absolute bg-white/30"
                        style={{
                          left: "33.33%",
                          top: "0",
                          width: "1px",
                          height: "100%",
                        }}
                      />
                      <div
                        class="absolute bg-white/30"
                        style={{
                          left: "66.66%",
                          top: "0",
                          width: "1px",
                          height: "100%",
                        }}
                      />
                      <div
                        class="absolute bg-white/30"
                        style={{
                          left: "0",
                          top: "33.33%",
                          width: "100%",
                          height: "1px",
                        }}
                      />
                      <div
                        class="absolute bg-white/30"
                        style={{
                          left: "0",
                          top: "66.66%",
                          width: "100%",
                          height: "1px",
                        }}
                      />
                    </div>
                  </div>

                  {/* Corner handles */}
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x}px`,
                      top: `${crop.y}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "nw")}
                  />
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x + crop.size}px`,
                      top: `${crop.y}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "ne")}
                  />
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x}px`,
                      top: `${crop.y + crop.size}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "sw")}
                  />
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-se-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x + crop.size}px`,
                      top: `${crop.y + crop.size}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "se")}
                  />
                </>
              )}
            </div>

            <div class="flex items-center gap-3">
              <Button
                type="button"
                disabled={uploading.value}
                onClick$={uploadCropped}
              >
                {uploading.value ? "Uploading…" : "Upload Image"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={uploading.value}
                onClick$={removeSelection}
              >
                Cancel
              </Button>
            </div>

            {uploadError.value && (
              <p class="text-sm text-red-600">{uploadError.value}</p>
            )}
          </div>
        )}

        {/* Non-crop error */}
        {!showCrop && uploadError.value && (
          <p class="text-sm text-red-600">{uploadError.value}</p>
        )}

        {uploadSuccess.value && !imageDataUrl.value && (
          <p class="text-sm text-green-600">Image uploaded successfully!</p>
        )}

        <input type="hidden" name={name} value={savedUrl.value} />
      </div>
    );
  },
);
