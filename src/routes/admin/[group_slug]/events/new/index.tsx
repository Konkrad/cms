import { component$, useSignal, useComputed$, $ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { SmartDatePicker } from "~/components/ui/SmartDatePicker";
import { eventsService } from "~/services/events.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { db } from "~/db/connection";
import { groups } from "~/db/schema";
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

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  location: z.string().min(1, "Location is required"),
  locationType: z.enum(["in_person", "online", "hybrid"]),
  onlineUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  visibility: z.enum(["global", "group_only"]).default("global"),
  image1: z.string().optional(),
  image2: z.string().optional(),
});

export const useCreateEvent = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user || (user.role !== "admin" && user.role !== "group_admin")) {
    return { success: false, error: "Unauthorized" };
  }

  const groupContext = await event.resolveValue(useGroupContext);
  const groupId = groupContext.isGlobal ? null : groupContext.group?.id;

  try {
    await eventsService.create({
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      location: data.location,
      locationType: data.locationType,
      onlineUrl: data.onlineUrl || null,
      visibility: groupContext.isGlobal ? data.visibility : "group_only",
      groupId: groupId as any,
      image1: data.image1 || null,
      image2: data.image2 || null,
      status: "published",
    });

    const redirectUrl = groupContext.isGlobal
      ? "/admin/global/events"
      : `/admin/${groupContext.group?.slug}/events`;
    throw event.redirect(303, redirectUrl);
  } catch (error: any) {
    if (error?.status === 303) throw error;
    return {
      success: false,
      error: error?.message || "Failed to create event",
    };
  }
}, zod$(eventSchema));

export default component$(() => {
  const createEventAction = useCreateEvent();
  const groupContext = useGroupContext();
  const isSubmitting = useSignal(false);
  const locationType = useSignal("in_person");
  
  const triggerUpload = useSignal(false);
  const successCount = useSignal(0);

  const handleSubmit = $(() => {
    console.log('[events/new] handleSubmit — setting triggerUpload=true');
    isSubmitting.value = true;
    triggerUpload.value = true;
  });

  const checkAndSubmit = $(() => {
    successCount.value++;
    console.log(`[events/new] checkAndSubmit — successCount=${successCount.value}`);
    // We have 2 uploaders
    if (successCount.value === 2) {
      const form = document.querySelector('form');
      console.log('[events/new] submitting form', form);
      if (form) {
        createEventAction.submit(new FormData(form));
      }
    }
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Event</h2>
        <Button
          href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/events`}
          variant="secondary"
        >
          Back to Events
        </Button>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <form preventdefault:submit onSubmit$={handleSubmit} class="space-y-6">
          <Input
            name="title"
            label="Title"
            placeholder="e.g. Monthly Community Meetup"
            required
          />
          <TextArea
            name="description"
            label="Description"
            placeholder="Describe the event..."
            required
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartDatePicker
              name="startTime"
              label="Start Time"
              enableTime={true}
              required
            />
            <SmartDatePicker
              name="endTime"
              label="End Time"
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
              placeholder="e.g. 123 Main St or 'Online'"
              required
            />
          </div>

          {(locationType.value === "online" ||
            locationType.value === "hybrid") && (
            <Input
              name="onlineUrl"
              label="Online Meeting URL"
              placeholder="https://zoom.us/j/..."
              required={locationType.value !== "in_person"}
            />
          )}

          {!groupContext.value.isGlobal && (
            <VisibilitySelector
              name="visibility"
              value="global"
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
              />
            </div>
          </div>

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Creating..." : "Create Event"}
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
