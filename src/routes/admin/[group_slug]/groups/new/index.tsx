import { component$, useSignal, $ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { groupsService } from "~/services/groups.service";
import { geocodingService } from "~/services/geocoding.service";
import { getCurrentUserData } from "~/utils/server-auth";

export const useGlobalOnly = routeLoader$(async ({ params, redirect }) => {
  const groupSlug = params.group_slug;
  // Only valid in the global admin context
  if (groupSlug !== "global") {
    throw redirect(302, `/admin/${groupSlug}`);
  }
  return { isGlobal: true };
});

const groupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  image1: z.string().optional(),
  image2: z.string().optional(),
  image3: z.string().optional(),
});

export const useCreateGroup = routeAction$(async (data, event) => {
  // Ensure user is authenticated and a platform admin
  const user = await getCurrentUserData(event as any);
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  // Only allowed from global admin context
  const groupSlug = event.params.group_slug;
  if (groupSlug !== "global") {
    return { success: false, error: "Not allowed in this context" };
  }

  try {
    // Geocode the provided location string
    const results = await geocodingService.forward(data.location);
    if (!results || results.length === 0) {
      return {
        success: false,
        error: "Unable to find location. Please enter a more specific address.",
      };
    }

    const best = results[0];

    await groupsService.create({
      name: data.name,
      latitude: String(best.latitude),
      longitude: String(best.longitude),
      image1: data.image1 || null,
      image2: data.image2 || null,
      image3: data.image3 || null,
    } as any);

    // Redirect back to the groups list after creation
    throw event.redirect(303, "/admin/global/groups");
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to create group",
    };
  }
}, zod$(groupSchema));

export default component$(() => {
  const createGroupAction = useCreateGroup();
  useGlobalOnly(); // Ensure we fail fast on UI if not in global context
  const isSubmitting = useSignal(false);
  const triggerUpload = useSignal(false);
  const successCount = useSignal(0);

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const checkAndSubmit = $(() => {
    successCount.value++;
    // We have 3 uploaders. If all are done or failed (we should handle both), we submit.
    if (successCount.value === 3) {
      const form = document.querySelector('form');
      if (form) {
        createGroupAction.submit(new FormData(form));
      }
    }
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Group</h2>
        <Button href="/admin/global/groups" variant="secondary">Back to Groups</Button>
      </div>

      <div class="bg-white rounded-lg shadow-sm p-6">
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
          <Input
            name="name"
            label="Name"
            placeholder="e.g. Berlin Community"
            required
          />
          <Input
            name="location"
            label="Location"
            placeholder="e.g. Berlin, Germany or Alexanderplatz, Berlin"
            required
          />

          <hr class="border-gray-200" />
          <p class="text-sm font-semibold text-gray-700">Group Page Images</p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image 1 — Left bottom tile</p>
              <ImageUploader
                name="image1"
                path="public/groups"
                triggerSignal={triggerUpload}
                aspectRatio="1/1"
                crop
                cropAspectRatio="1/1"
                onSettled$={checkAndSubmit}
              />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image 2 — Middle tile (large)</p>
              <ImageUploader
                name="image2"
                path="public/groups"
                pipeline="standard"
                triggerSignal={triggerUpload}
                aspectRatio="4/3"
                crop
                cropAspectRatio="4/3"
                onSettled$={checkAndSubmit}
              />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image 3 — Right top tile</p>
              <ImageUploader
                name="image3"
                path="public/groups"
                pipeline="standard"
                triggerSignal={triggerUpload}
                aspectRatio="1/1"
                crop
                cropAspectRatio="1/1"
                onSettled$={checkAndSubmit}
              />
            </div>
          </div>

          {createGroupAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
              {createGroupAction.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting.value}
            >
              {isSubmitting.value ? "Creating..." : "Create Group"}
            </Button>
            <Button href="/admin/global/groups" variant="secondary">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
});
