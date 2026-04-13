import { component$, $, useSignal } from "@qwik.dev/core";
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
import { db } from "~/db/connection";
import { groups } from "~/db/schema";
import { eq } from "drizzle-orm";

export const useGlobalOnly = routeLoader$(async ({ params, redirect }) => {
  const groupSlug = params.group_slug;
  if (groupSlug !== "global") {
    throw redirect(302, `/admin/${groupSlug}`);
  }
  return { isGlobal: true };
});

export const useGroupData = routeLoader$(async (event) => {
  const { id } = event.params;
  const group = await db.query.groups.findFirst({
    where: eq(groups.id, id),
  });
  if (!group) {
    throw event.error(404, "Group not found");
  }
  return group;
});

const groupSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  image1: z.string().optional(),
  image2: z.string().optional(),
  image3: z.string().optional(),
});

export const useUpdateGroup = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user || user.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const groupSlug = event.params.group_slug;
  if (groupSlug !== "global") {
    return { success: false, error: "Not allowed in this context" };
  }

  try {
    const results = await geocodingService.forward(data.location);
    if (!results || results.length === 0) {
      return {
        success: false,
        error: "Unable to find location. Please enter a more specific address.",
      };
    }

    const best = results[0];

    await groupsService.update(data.id, {
      name: data.name,
      latitude: String(best.latitude),
      longitude: String(best.longitude),
      image1: data.image1 || null,
      image2: data.image2 || null,
      image3: data.image3 || null,
    });

    throw event.redirect(303, "/admin/global/groups");
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to update group",
    };
  }
}, zod$(groupSchema));

export default component$(() => {
  const updateGroupAction = useUpdateGroup();
  const groupData = useGroupData();
  useGlobalOnly();
  const isSubmitting = useSignal(false);
  
  const triggerUpload = useSignal(false);
  const successCount = useSignal(0);
  const showImage1Uploader = useSignal(!groupData.value.image1);
  const showImage2Uploader = useSignal(!groupData.value.image2);
  const showImage3Uploader = useSignal(!groupData.value.image3);

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const checkAndSubmit = $(() => {
    successCount.value++;
    // 3 images
    if (successCount.value === 3) {
      const form = document.querySelector('form');
      if (form) {
        updateGroupAction.submit(new FormData(form));
      }
    }
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Group</h2>
        <Button href="/admin/global/groups" variant="secondary">Back to Groups</Button>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
          <input type="hidden" name="id" value={groupData.value.id} />
          <Input
            name="name"
            label="Name"
            value={groupData.value.name}
            required
          />
          <Input
            name="location"
            label="Location"
            placeholder="e.g. City, Country"
            required
          />

          <hr class="border-gray-200" />
          <p class="text-sm font-semibold text-gray-700">Group Page Images</p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image 1 — Left bottom tile</p>
              {!showImage1Uploader.value && groupData.value.image1 ? (
                <div class="relative rounded border border-gray-200 overflow-hidden">
                  <img src={groupData.value.image1} alt="Current" class="w-full object-cover" style={{ aspectRatio: "1/1" }} />
                  <button type="button" class="absolute bottom-2 right-2 rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-white" onClick$={() => { showImage1Uploader.value = true; }}>Change image</button>
                  <input type="hidden" name="image1" value={groupData.value.image1} />
                </div>
              ) : (
                <ImageUploader
                  name="image1"
                  path="public/groups"
                  triggerSignal={triggerUpload}
                  aspectRatio="1/1"
                  onSettled$={checkAndSubmit}
                />
              )}
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image 2 — Middle tile (large)</p>
              {!showImage2Uploader.value && groupData.value.image2 ? (
                <div class="relative rounded border border-gray-200 overflow-hidden">
                  <img src={groupData.value.image2} alt="Current" class="w-full object-cover" style={{ aspectRatio: "4/3" }} />
                  <button type="button" class="absolute bottom-2 right-2 rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-white" onClick$={() => { showImage2Uploader.value = true; }}>Change image</button>
                  <input type="hidden" name="image2" value={groupData.value.image2} />
                </div>
              ) : (
                <ImageUploader
                  name="image2"
                  path="public/groups"
                  pipeline="standard"
                  triggerSignal={triggerUpload}
                  aspectRatio="4/3"
                  onSettled$={checkAndSubmit}
                />
              )}
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image 3 — Right top tile</p>
              {!showImage3Uploader.value && groupData.value.image3 ? (
                <div class="relative rounded border border-gray-200 overflow-hidden">
                  <img src={groupData.value.image3} alt="Current" class="w-full object-cover" style={{ aspectRatio: "1/1" }} />
                  <button type="button" class="absolute bottom-2 right-2 rounded bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 shadow hover:bg-white" onClick$={() => { showImage3Uploader.value = true; }}>Change image</button>
                  <input type="hidden" name="image3" value={groupData.value.image3} />
                </div>
              ) : (
                <ImageUploader
                  name="image3"
                  path="public/groups"
                  pipeline="standard"
                  triggerSignal={triggerUpload}
                  aspectRatio="1/1"
                  onSettled$={checkAndSubmit}
                />
              )}
            </div>
          </div>

          <div class="flex gap-4">
            <Button
              type="submit"
              disabled={isSubmitting.value}
            >
              {isSubmitting.value ? "Saving Changes..." : "Update Group"}
            </Button>
            <Button href="/admin/global/groups" variant="secondary">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
});
