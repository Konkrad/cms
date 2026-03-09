import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  routeAction$,
  routeLoader$,
  useLocation,
  zod$,
  z,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { PhotoUploader } from "~/components/events/PhotoUploader";
import { Card } from "~/components/ui/Card";
import { photosService } from "~/services/photos.service";
import { eventsService } from "~/services/events.service";
import { getServerSession } from "~/utils/server-auth";
import { generatePresignedGetUrl } from "~/utils/secure-urls";

export const useEvent = routeLoader$(async ({ params }) => {
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error("Event not found");
  }
  return event;
});

export const usePhotos = routeLoader$(async ({ params }) => {
  const photos = await photosService.getByEventId(params.id);

  // Generate presigned URLs for each photo
  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const thumbnailUrl = photo.thumbnailPath
        ? await generatePresignedGetUrl(
            photo.thumbnailPath.replace(/^\//, ""),
            60 * 60,
          )
        : null;
      const fullUrl = await generatePresignedGetUrl(
        photo.filePath.replace(/^\//, ""),
        60 * 60,
      );

      return {
        ...photo,
        thumbnailUrl,
        fullUrl,
      };
    }),
  );

  return photosWithUrls;
});

export const useCreatePhoto = routeAction$(
  async (data, requestEvent) => {
    const { params, fail } = requestEvent;
    const user = await getServerSession(requestEvent);
    if (!user) {
      return fail(401, { message: "Not authenticated" });
    }

    // Get event and verify ownership
    const event = await eventsService.getById(params.id);
    if (!event) {
      return fail(404, { message: "Event not found" });
    }

    if (event.userId !== user.id) {
      return fail(403, { message: "Not authorized - must be event organizer" });
    }

    // Check if event has started
    const eventStartDate = new Date(event.startDate);
    const now = new Date();
    if (now < eventStartDate) {
      return fail(400, { message: "Cannot upload photos before event starts" });
    }

    // Create photo record
    const photo = await photosService.create({
      eventId: params.id,
      filePath: data.filePath,
      thumbnailPath: data.thumbnailPath,
      uploadedBy: user.id,
    });

    return {
      success: true,
      photo,
    };
  },
  zod$({
    filePath: z.string().startsWith("/private/events/").endsWith(".webp"),
    thumbnailPath: z.string().optional(),
  }),
);

export default component$(() => {
  const event = useEvent();
  const photos = usePhotos();
  const location = useLocation();
  const parts = location.url.pathname.split("/");
  const groupSlug = parts[2] || "global";
  const backUrl = `/admin/${groupSlug}/events/${event.value.id}`;
  const createPhotoAction = useCreatePhoto();
  const uploadSuccess = useSignal<string | null>(null);
  const uploadError = useSignal<string | null>(null);

  return (
    <div class="container mx-auto px-4 py-8 max-w-6xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">
          Manage Photos: {event.value.title}
        </h1>
        <p class="mt-2 text-gray-600">
          Upload photos that will be visible to attendees who were scanned
        </p>
      </div>

      {/* Upload Section */}
      <Card class="mb-8">
        <PhotoUploader
          eventId={event.value.id}
          onUploadSuccess={$(
            async (filePath: string, thumbnailPath?: string) => {
              console.log("Submitting photo to database:", {
                filePath,
                thumbnailPath,
              });

              // Register the photo in database
              const result = await createPhotoAction.submit({
                filePath,
                thumbnailPath,
              });

              console.log("Photo submission result:", result.value);

              if (result.value?.success) {
                uploadSuccess.value = "Photo uploaded successfully!";
                uploadError.value = null;
                // Reload photos list
                window.location.reload();
              } else {
                const errorMsg =
                  result.value?.message ||
                  (result.value?.fieldErrors
                    ? JSON.stringify(result.value.fieldErrors)
                    : "Failed to register photo");
                console.error("Photo submission failed:", result.value);
                uploadError.value = errorMsg;
                uploadSuccess.value = null;
              }
            },
          )}
          onUploadError={$((error: string) => {
            console.error("Upload error:", error);
            uploadError.value = error;
            uploadSuccess.value = null;
          })}
        />

        {uploadSuccess.value && (
          <div class="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {uploadSuccess.value}
          </div>
        )}

        {uploadError.value && (
          <div class="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {uploadError.value}
          </div>
        )}

        {createPhotoAction.value?.fieldErrors && (
          <div class="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Validation errors:</strong>
            <pre class="mt-2 text-sm">
              {JSON.stringify(createPhotoAction.value.fieldErrors, null, 2)}
            </pre>
          </div>
        )}
      </Card>

      {/* Photos List */}
      <Card>
        <h2 class="text-xl font-bold text-gray-900 mb-4">
          Uploaded Photos ({photos.value.length})
        </h2>

        {photos.value.length === 0 ? (
          <div class="text-center py-8 text-gray-500">
            <p>No photos uploaded yet. Use the uploader above to add photos.</p>
          </div>
        ) : (
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.value.map((photo) => (
              <div
                key={photo.id}
                class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
              >
                <img
                  src={photo.thumbnailUrl || photo.fullUrl}
                  alt={photo.filePath.split("/").pop()}
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p class="text-xs text-white truncate" title={photo.filePath}>
                    {photo.filePath.split("/").pop()}
                  </p>
                  <p class="text-xs text-white/80">
                    {new Date(photo.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div class="mt-6">
        <a href={backUrl} class="text-blue-600 hover:text-blue-700 font-medium">
          ← Back to Event Dashboard
        </a>
      </div>
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const event = resolveValue(useEvent);
  return {
    title: `Manage Photos - ${event.title}`,
    meta: [
      {
        name: "description",
        content: `Upload and manage photos for ${event.title} event`,
      },
    ],
  };
};
