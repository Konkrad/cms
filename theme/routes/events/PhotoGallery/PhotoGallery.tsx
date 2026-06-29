import { component$, useSignal, $, type Signal } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { EmptyState } from "~/components/ui/EmptyState";

interface PhotoData {
  id: string;
  uploadedAt: string;
}

interface PhotoGalleryProps {
  photos: PhotoData[];
  onRequestPhotoUrl: (photoId: string) => Promise<string | null>;
}

export const PhotoGallery = component$<PhotoGalleryProps>(
  ({ photos, onRequestPhotoUrl }) => {
    const photoUrls = useSignal<Record<string, string>>({});
    const loadingPhotos = useSignal<Record<string, boolean>>({});
    const selectedPhoto = useSignal<string | null>(null);

    const loadPhotoUrl = $(async (photoId: string) => {
      if (photoUrls.value[photoId]) {
        return; // Already loaded
      }

      loadingPhotos.value = { ...loadingPhotos.value, [photoId]: true };

      try {
        const url = await onRequestPhotoUrl(photoId);
        if (url) {
          photoUrls.value = { ...photoUrls.value, [photoId]: url };
        }
      } catch (error) {
        console.error("Failed to load photo URL:", error);
      } finally {
        loadingPhotos.value = { ...loadingPhotos.value, [photoId]: false };
      }
    });

    return (
      <div class="space-y-4">
        {photos.length === 0 ? (
          <EmptyState
            message="No photos yet"
            description="Photos will appear here once the organizer uploads them"
          >
            <svg
              class="w-16 h-16 mx-auto mb-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </EmptyState>
        ) : (
          <>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  class="relative aspect-square bg-bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  onClick$={async () => {
                    await loadPhotoUrl(photo.id);
                    selectedPhoto.value = photo.id;
                  }}
                >
                  {photoUrls.value[photo.id] ? (
                    <img
                      src={photoUrls.value[photo.id]}
                      alt="Event photo"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div class="w-full h-full flex items-center justify-center">
                      {loadingPhotos.value[photo.id] ? (
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      ) : (
                        <Button
                          onClick$={async () => {
                            await loadPhotoUrl(photo.id);
                          }}
                        >
                          Load Photo
                        </Button>
                      )}
                    </div>
                  )}
                  <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
                    <p class="text-xs text-white">
                      {new Date(photo.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Lightbox Modal */}
            {selectedPhoto.value && photoUrls.value[selectedPhoto.value] && (
              <div
                class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                onClick$={() => {
                  selectedPhoto.value = null;
                }}
              >
                <div class="relative max-w-4xl max-h-full">
                  <button
                    class="absolute top-4 right-4 text-white hover:text-border"
                    onClick$={() => {
                      selectedPhoto.value = null;
                    }}
                  >
                    <svg
                      class="w-8 h-8"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                  <img
                    src={photoUrls.value[selectedPhoto.value]}
                    alt="Event photo full size"
                    class="max-w-full max-h-[90vh] object-contain"
                    onClick$={(e) => {
                      e.stopPropagation();
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  },
);
