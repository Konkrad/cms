import { component$ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  zod$,
  z,
  type DocumentHead,
} from "@qwik.dev/router";
import { PhotoGallery } from "~/components/events/PhotoGallery";
import { Card } from "~/components/ui/Card";
import { photosService } from "~/services/photos.service";
import { eventsService } from "~/services/events.service";
import { getServerSession } from "~/utils/server-auth";

export const useEvent = routeLoader$(async ({ params }) => {
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error("Event not found");
  }
  return event;
});

export const usePhotos = routeLoader$(async (event) => {
  const user = await getServerSession(event);
  if (!user) {
    return event.fail(401, { message: "Please log in to view photos" });
  }

  // Check if user attended the event
  const hasAttended = await photosService.checkUserAttendance(
    user.id,
    event.params.id,
  );

  if (!hasAttended) {
    return event.fail(403, {
      message:
        "Only attendees who were scanned can view photos. Please ensure your ticket was scanned at the event.",
    });
  }

  // Get photos for this event
  const photos = await photosService.getByEventId(event.params.id, {
    limit: 100,
    offset: 0,
  });

  return photos.map((photo) => ({
    id: photo.id,
    thumbnailPath: photo.thumbnailPath,
    uploadedAt: photo.uploadedAt,
  }));
});

export const useGenerateSecureUrl = routeAction$(
  async (data, event) => {
    const user = await getServerSession(event);
    if (!user) {
      return event.fail(401, { message: "Not authenticated" });
    }

    // Generate secure URL
    const result = await photosService.generateSecureUrl(data.photoId, user.id);

    if (!result) {
      return event.fail(403, {
        message: "Cannot access this photo. You must have attended the event.",
      });
    }

    return {
      success: true,
      url: result.url,
      expiresAt: result.expiresAt,
    };
  },
  zod$({
    photoId: z.string().uuid(),
  }),
);

export default component$(() => {
  const event = useEvent();
  const photos = usePhotos();
  const generateUrlAction = useGenerateSecureUrl();

  return (
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">
          Event Photos: {event.value.title}
        </h1>
        <p class="mt-2 text-gray-600">
          Private photos accessible only to verified attendees
        </p>
      </div>

      {photos.value.failed ? (
        <Card>
          <div class="text-center py-8">
            <svg
              class="w-16 h-16 mx-auto mb-4 text-red-400"
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
            <p class="text-lg font-medium text-gray-900">Access Restricted</p>
            <p class="text-sm text-gray-600 mt-2">
              {photos.value.message ||
                "You do not have permission to view these photos"}
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <PhotoGallery
            photos={photos.value as any}
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
          href={`/events/${event.value.id}`}
          class="text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Event Details
        </a>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const event = resolveValue(useEvent);
  return {
    title: `Photos - ${event.title}`,
    meta: [
      {
        name: "description",
        content: `View photos from ${event.title} event`,
      },
    ],
  };
};
