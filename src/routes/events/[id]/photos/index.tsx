import { component$ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  zod$,
  z,
  type DocumentHead,
} from "@qwik.dev/router";
import { photosService } from "~/services/photos.service";
import { eventsService } from "~/services/events.service";
import { getServerSession } from "~/utils/server-auth";
import { useThemeComponent$ } from "~/utils/theme-loader";
import { ThemeComponent } from "~/utils/theme-components";
import type { FC } from "react";

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
  const EventPhotosView = useThemeComponent$(() => import("~theme/routes/events/EventPhotosView"));
  return (
    <ThemeComponent
      resource={EventPhotosView}
      event={event.value}
      photos={photos.value}
      generateUrlAction={generateUrlAction}
    />
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
