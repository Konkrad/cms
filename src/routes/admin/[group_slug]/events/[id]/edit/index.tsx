import {
  component$,
  useSignal,
  useComputed$,
  useTask$,
} from "@qwik.dev/core";
import { $ } from "@qwik.dev/core";
import {
  routeAction$,
  routeLoader$,
  z,
  zod$,
  useLocation,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { SmartDatePicker } from "~/components/ui/SmartDatePicker";
import { eventsService } from "~/services/events.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { db } from "~/db/connection";
import { groups, events } from "~/db/schema";
import { eq } from "drizzle-orm";
import { VisibilitySelector } from "~/components/admin/VisibilitySelector";

export const useGroupContext = routeLoader$(async (event) => {
  const groupSlug = event.params.group_slug;
  if (groupSlug === "global") {
    return { isGlobal: true };
  }
  const group = await db.query.groups.findFirst({
    where: eq(groups.slug, groupSlug),
  });
  if (!group) {
    throw event.error(404, "Group not found");
  }
  return { isGlobal: false, group };
});

export const useEventData = routeLoader$(async (event) => {
  const { id } = event.params;
  const data = await db.query.events.findFirst({
    where: eq(events.id, id),
  });
  if (!data) {
    throw event.error(404, "Event not found");
  }
  return data;
});

const editEventSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().min(1, "Location is required"),
  locationType: z.enum(["in_person", "online", "hybrid"]),
  onlineUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  visibility: z.enum(["global", "group_only"]).default("global"),
  image1: z.string().optional(),
  image2: z.string().optional(),
});

export const useUpdateEvent = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user || (user.role !== "admin" && user.role !== "group_admin")) {
    return { success: false, error: "Unauthorized" };
  }

  const groupContext = await event.resolveValue(useGroupContext);

  try {
    await eventsService.update(data.id, {
      title: data.title,
      description: data.description,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      location: data.location,
      locationType: data.locationType,
      onlineUrl: data.onlineUrl || null,
      visibility: groupContext.isGlobal ? data.visibility : "group_only",
      image1: data.image1 || null,
      image2: data.image2 || null,
    });

    const redirectUrl = groupContext.isGlobal
      ? "/admin/global/events"
      : `/admin/${groupContext.group?.slug}/events`;
    throw event.redirect(303, redirectUrl);
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to update event",
    };
  }
}, zod$(editEventSchema));

export default component$(() => {
  const updateEventAction = useUpdateEvent();
  const groupContext = useGroupContext();
  const eventData = useEventData();
  const isSubmitting = useSignal(false);
  const locationType = useSignal(eventData.value.locationType);
  
  const triggerUpload = useSignal(false);
  const successCount = useSignal(0);
  const showImage1Uploader = useSignal(!eventData.value.image1);
  const showImage2Uploader = useSignal(!eventData.value.image2);

  const handleSubmit = $(() => {
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const checkAndSubmit = $(() => {
    successCount.value++;
    // We have 2 uploaders
    if (successCount.value === 2) {
      const form = document.querySelector('form');
      if (form) {
        updateEventAction.submit(new FormData(form));
      }
    }
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Event</h2>
        <Button
          href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/events`}
          variant="secondary"
        >
          Back to Events
        </Button>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
          <input type="hidden" name="id" value={eventData.value.id} />
          <Input
            name="title"
            label="Title"
            value={eventData.value.title}
            required
          />
          <TextArea
            name="description"
            label="Description"
            value={eventData.value.description}
            required
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartDatePicker
              name="startDate"
              label="Start Time"
              value={eventData.value.startDate}
              enableTime={true}
              required
            />
            <SmartDatePicker
              name="endDate"
              label="End Time"
              value={eventData.value.endDate}
              enableTime={true}
              required
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              name="locationType"
              label="Location Type"
              options={[
                { label: "In Person", value: "in_person" },
                { label: "Online", value: "online" },
                { label: "Hybrid", value: "hybrid" },
              ]}
              value={locationType.value}
              onChange$={(e) => {
                locationType.value = (e.target as HTMLSelectElement).value;
              }}
            />
            <Input
              name="location"
              label="Location/Address"
              value={eventData.value.location}
              required
            />
          </div>

          {(locationType.value === "online" ||
            locationType.value === "hybrid") && (
            <Input
              name="onlineUrl"
              label="Online Meeting URL"
              value={eventData.value.onlineUrl || ""}
              required={locationType.value !== "in_person"}
            />
          )}

          {!groupContext.value.isGlobal && (
            <VisibilitySelector
              name="visibility"
              value={eventData.value.visibility as any}
              isGroupContext={true}
            />
          )}

          <hr class="border-gray-200" />
          <p class="text-sm font-semibold text-gray-700">Event Page Images</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image Left (square)</p>
              <ImageUploader
                name="image1"
                path="public/events"
                triggerSignal={triggerUpload}
                aspectRatio="1/1"
                onSettled$={checkAndSubmit}
                currentUrl={eventData.value.image1 || undefined}
              />
            </div>
            <div>
              <p class="text-sm font-medium text-gray-700 mb-1">Image Right (square)</p>
              <ImageUploader
                name="image2"
                path="public/events"
                triggerSignal={triggerUpload}
                aspectRatio="1/1"
                onSettled$={checkAndSubmit}
                currentUrl={eventData.value.image2 || undefined}
              />
            </div>
          </div>

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Saving Changes..." : "Update Event"}
            </Button>
            <Button
              href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/events`}
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});
