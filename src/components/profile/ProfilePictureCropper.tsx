import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useStore,
  type QRL,
} from "@builder.io/qwik";

interface CropState {
  x: number;
  y: number;
  size: number;
}

interface ProfilePictureCropperProps {
  currentPictureUrl?: string | null;
  onUploadComplete$?: QRL<(urls: { picture: string; pictureSmall: string }) => void>;
}

export const ProfilePictureCropper = component$<ProfilePictureCropperProps>(
  ({ currentPictureUrl, onUploadComplete$ }) => {
    const fileInputRef = useSignal<HTMLInputElement>();
    const imageRef = useSignal<HTMLImageElement>();
    const containerRef = useSignal<HTMLDivElement>();

    const imageDataUrl = useSignal<string | null>(null);
    const selectedFile = useSignal<File | null>(null);
    const uploading = useSignal(false);
    const uploadError = useSignal<string | null>(null);
    const uploadSuccess = useSignal(false);

    // Natural image dimensions
    const naturalWidth = useSignal(0);
    const naturalHeight = useSignal(0);

    // Display dimensions of the image within the container
    const displayWidth = useSignal(0);
    const displayHeight = useSignal(0);
    const imageOffsetX = useSignal(0);
    const imageOffsetY = useSignal(0);

    // Crop state in display pixels (relative to the image element)
    const crop = useStore<CropState>({ x: 0, y: 0, size: 100 });

    // Drag state
    const dragging = useSignal<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
    const dragStart = useStore({ mouseX: 0, mouseY: 0, cropX: 0, cropY: 0, cropSize: 0 });

    const computeDisplayDimensions = $(() => {
      const img = imageRef.value;
      const container = containerRef.value;
      if (!img || !container) return;

      const containerWidth = container.clientWidth;
      const maxHeight = 400;

      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      if (!nw || !nh) return;

      naturalWidth.value = nw;
      naturalHeight.value = nh;

      // Fit image within container maintaining aspect ratio
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
      imageOffsetY.value = 0;

      // Initialize crop to largest centered square
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
      selectedFile.value = file;

      const reader = new FileReader();
      reader.onload = () => {
        imageDataUrl.value = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Recalculate display dimensions when image loads
    useVisibleTask$(({ track, cleanup }) => {
      track(() => imageDataUrl.value);

      const img = imageRef.value;
      if (!img) return;

      const handler = () => {
        computeDisplayDimensions();
      };

      img.addEventListener("load", handler);
      cleanup(() => img.removeEventListener("load", handler));
    });

    // Attach pointer events on the container for dragging
    useVisibleTask$(({ cleanup }) => {
      const container = containerRef.value;
      if (!container) return;

      const onPointerMove = (e: PointerEvent) => {
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

          // Clamp within image bounds
          newX = Math.max(0, Math.min(newX, dw - size));
          newY = Math.max(0, Math.min(newY, dh - size));

          crop.x = newX;
          crop.y = newY;
        } else {
          // Corner resize – keep square
          let newSize = dragStart.cropSize;
          let newX = dragStart.cropX;
          let newY = dragStart.cropY;

          // Determine delta based on which corner
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

          // Enforce minimum size
          const minSize = 40;
          if (newSize < minSize) {
            const diff = minSize - newSize;
            newSize = minSize;
            if (handle === "sw" || handle === "nw") newX -= diff;
            if (handle === "ne" || handle === "nw") newY -= diff;
          }

          // Clamp within bounds
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

          // Keep square using the smaller constrained dimension
          const maxPossible = Math.min(dw - newX, dh - newY);
          newSize = Math.min(newSize, maxPossible);
          newSize = Math.max(newSize, minSize);

          crop.x = newX;
          crop.y = newY;
          crop.size = newSize;
        }
      };

      const onPointerUp = () => {
        dragging.value = null;
      };

      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointerleave", onPointerUp);

      cleanup(() => {
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointerleave", onPointerUp);
      });
    });

    const startDrag = $((e: PointerEvent, handle: "move" | "nw" | "ne" | "sw" | "se") => {
      e.preventDefault();
      e.stopPropagation();
      dragging.value = handle;
      dragStart.mouseX = e.clientX;
      dragStart.mouseY = e.clientY;
      dragStart.cropX = crop.x;
      dragStart.cropY = crop.y;
      dragStart.cropSize = crop.size;
    });

    const upload = $(async () => {
      const file = selectedFile.value;
      if (!file) return;

      uploading.value = true;
      uploadError.value = null;
      uploadSuccess.value = false;

      // Convert crop from display pixels to ratios (0–1)
      const dw = displayWidth.value;
      const dh = displayHeight.value;
      if (!dw || !dh) {
        uploadError.value = "Image dimensions not available";
        uploading.value = false;
        return;
      }

      const cropRatioX = crop.x / dw;
      const cropRatioY = crop.y / dh;
      const cropRatioW = crop.size / dw;
      const cropRatioH = crop.size / dh;

      const response = await fetch("/api/images/profile-picture", {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          "x-crop-x": cropRatioX.toFixed(6),
          "x-crop-y": cropRatioY.toFixed(6),
          "x-crop-width": cropRatioW.toFixed(6),
          "x-crop-height": cropRatioH.toFixed(6),
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        uploadError.value = result.error || "Upload failed";
        uploading.value = false;
        return;
      }

      uploading.value = false;
      uploadSuccess.value = true;

      if (onUploadComplete$) {
        await onUploadComplete$({
          picture: result.urls.picture,
          pictureSmall: result.urls.pictureSmall,
        });
      }
    });

    const removeSelection = $(() => {
      imageDataUrl.value = null;
      selectedFile.value = null;
      uploadSuccess.value = false;
      uploadError.value = null;
      if (fileInputRef.value) {
        fileInputRef.value.value = "";
      }
    });

    return (
      <div class="space-y-4">
        <label class="text-sm font-medium text-gray-700 block">
          Profile Picture
        </label>

        {/* Current picture preview */}
        {!imageDataUrl.value && currentPictureUrl && (
          <div class="flex items-center gap-4">
            <img
              src={currentPictureUrl}
              alt="Current profile picture"
              width={80}
              height={80}
              class="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
            <span class="text-sm text-gray-500">Current picture</span>
          </div>
        )}

        {/* File input */}
        {!imageDataUrl.value && (
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
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
            <p class="mt-2 text-sm text-gray-600">
              Click to select a photo
            </p>
            <p class="mt-1 text-xs text-gray-400">
              JPG, PNG or WebP. You'll be able to crop it.
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          onChange$={onFileSelect}
        />

        {/* Crop area */}
        {imageDataUrl.value && (
          <div class="space-y-3">
            <p class="text-sm text-gray-600">
              Drag the square to select the area for your profile picture. Drag corners to resize.
            </p>
            <div
              ref={containerRef}
              class="relative select-none overflow-hidden bg-gray-100 rounded-lg"
              style={{
                height: `${displayHeight.value || 400}px`,
                touchAction: "none",
              }}
            >
              {/* The image */}
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

              {/* Dark overlay – four rectangles around the crop area */}
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

                  {/* Crop box border + move handle */}
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
                    {/* Grid lines */}
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
                  {/* NW */}
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x}px`,
                      top: `${crop.y}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "nw")}
                  />
                  {/* NE */}
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x + crop.size}px`,
                      top: `${crop.y}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "ne")}
                  />
                  {/* SW */}
                  <div
                    class="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${imageOffsetX.value + crop.x}px`,
                      top: `${crop.y + crop.size}px`,
                    }}
                    onPointerDown$={(e: PointerEvent) => startDrag(e, "sw")}
                  />
                  {/* SE */}
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

            {/* Actions */}
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={uploading.value}
                onClick$={upload}
              >
                {uploading.value ? "Uploading…" : "Upload Picture"}
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
                disabled={uploading.value}
                onClick$={removeSelection}
              >
                Cancel
              </button>
            </div>

            {uploadError.value && (
              <p class="text-sm text-red-600">{uploadError.value}</p>
            )}
            {uploadSuccess.value && (
              <p class="text-sm text-green-600">
                Profile picture updated successfully!
              </p>
            )}
          </div>
        )}
      </div>
    );
  },
);
