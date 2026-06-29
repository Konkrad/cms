import { component$ } from "@qwik.dev/core";
import { Card } from "~/components/ui/Card";
import { PhotoGallery } from "~theme/routes/events/PhotoGallery";
import type {
  EventPhotosData,
  EventPhotosEventData,
  GenerateSecureUrlAction,
} from "~/contracts/event-photos";

/** Themed view for the private event photo gallery (`/events/[id]/photos`). */
export const EventPhotosView = component$<{
  event: EventPhotosEventData;
  photos: EventPhotosData;
  generateUrlAction: GenerateSecureUrlAction;
}>(({ event, photos, generateUrlAction }) => {
  return (
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-text-heading">
          Event Photos: {event.title}
        </h1>
        <p class="mt-2 text-text-secondary">
          Private photos accessible only to verified attendees
        </p>
      </div>

      {photos.failed ? (
        <Card>
          <div class="text-center py-8">
            <svg
              class="w-16 h-16 mx-auto mb-4 text-error"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p class="text-lg font-medium text-text-heading">Access Restricted</p>
            <p class="text-sm text-text-secondary mt-2">
              {photos.message ||
                "You do not have permission to view these photos"}
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <PhotoGallery
            photos={photos as any}
            onRequestPhotoUrl={async (photoId: string) => {
              const result = await generateUrlAction.submit({ photoId });

              if (result.value?.success) {
                return result.value.url;
              }

              console.error(
                "Failed to generate photo URL:",
                result.value?.message,
              );
              return null;
            }}
          />
        </Card>
      )}

      <div class="mt-6">
        <a
          href={`/events/${event.id}`}
          class="text-primary hover:text-primary font-medium"
        >
          ← Back to Event Details
        </a>
      </div>
    </div>
  );
});
