import { component$, useSignal, $ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  useLocation,
  zod$,
  z,
  type DocumentHead,
  Link,
} from "@qwik.dev/router";
import { ImageUploader } from "~/components/ui";
import { Button } from "~/components/ui";
import { Card } from "~/components/ui/Card";
import { photosService } from "~/services/photos.service";
import { eventsService } from "~/services/events.service";
import { deleteS3Objects } from "~/services/image-processing.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { generatePresignedGetUrl } from "~/utils/secure-urls";
import { deriveThumbnailKey } from "~/utils/images";

export const useEvent = routeLoader$(async ({ params }) => {
  const event = await eventsService.getById(params.id);
  if (!event) {
    throw new Error("Event not found");
  }
  return event;
});

export const usePhotos = routeLoader$(async ({ params }) => {
  const photos = await photosService.getByEventId(params.id);

  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const thumbnailUrl = await generatePresignedGetUrl(
        deriveThumbnailKey(photo.filePath),
        60 * 60,
      );
      const fullUrl = await generatePresignedGetUrl(photo.filePath, 60 * 60);

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
    const user = await getCurrentUserData(requestEvent as any);
    if (!user || (user.role !== "admin" && user.role !== "group_admin")) {
      return fail(403, { message: "Unauthorized" });
    }

    const event = await eventsService.getById(params.id);
    if (!event) {
      return fail(404, { message: "Event not found" });
    }

    // Create photo record
    const photo = await photosService.create({
      eventId: params.id,
      filePath: data.filePath,
      uploadedBy: user.id,
    });

    return {
      success: true,
      photo,
    };
  },
  zod$({
    filePath: z.string().startsWith("private/events/").endsWith(".webp"),
  }),
);

export const useDeletePhoto = routeAction$(
  async (data, requestEvent) => {
    const { params, fail } = requestEvent;
    const user = await getCurrentUserData(requestEvent as any);
    if (!user || (user.role !== "admin" && user.role !== "group_admin")) {
      return fail(403, { message: "Unauthorized" });
    }

    const event = await eventsService.getById(params.id);
    if (!event) return fail(404, { message: "Event not found" });

    const photo = await photosService.getById(data.photoId);
    if (!photo || photo.eventId !== params.id) {
      return fail(404, { message: "Photo not found" });
    }

    // Delete from S3 (main + thumbnail)
    await deleteS3Objects([photo.filePath, deriveThumbnailKey(photo.filePath)]);

    // Delete from DB
    await photosService.delete(photo.id);

    return { success: true };
  },
  zod$({
    photoId: z.string().min(1),
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
  const deletePhotoAction = useDeletePhoto();
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
        <ImageUploader
          path={`private/events/${event.value.id}/photos`}
          pipeline="gallery"
          autoUpload
          aspectRatio="4/3"
          onFileUploaded$={$(async (response: { filePath?: string }) => {
            if (!response.filePath) {
              uploadError.value = "Upload failed — no file path in response";
              return;
            }

            const result = await createPhotoAction.submit({
              filePath: response.filePath,
            });

            if (result.value?.success) {
              uploadSuccess.value = "Photo uploaded successfully!";
              uploadError.value = null;
              window.location.reload();
            } else {
              const errorMsg =
                result.value?.message ||
                (result.value?.fieldErrors
                  ? JSON.stringify(result.value.fieldErrors)
                  : "Failed to register photo");
              uploadError.value = errorMsg;
              uploadSuccess.value = null;
            }
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
                class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
              >
                <img
                  src={photo.thumbnailUrl || photo.fullUrl}
                  alt={photo.filePath.split("/").pop()}
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
                <div class="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div class="flex justify-end p-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick$={async () => {
                        if (!confirm("Delete this photo?")) return;
                        await deletePhotoAction.submit({ photoId: photo.id });
                        window.location.reload();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  <div class="p-2">
                    <p class="text-xs text-white truncate" title={photo.filePath}>
                      {photo.filePath.split("/").pop()}
                    </p>
                    <p class="text-xs text-white/80">
                      {new Date(photo.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div class="mt-6">
        <Link href={backUrl} class="text-blue-600 hover:text-blue-700 font-medium">
          ← Back to Event Dashboard
        </Link>
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
