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
import { VisibilitySelector } from "~/components/admin/VisibilitySelector";

export const useGroupContext = routeLoader$(async (event) => {
  const groupSlug = event.params.group_slug;
  if (groupSlug === "global") {
    return { isGlobal: true };
  }
  const group = await db.query.groups.findFirst({
    where: { slug: groupSlug },
  });
  if (!group) {
    throw event.error(404, "Group not found");
  }
  return { isGlobal: false, group };
});

const eventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Description is required"),
  startDate: z.string().min(1, "Start time is required"),
  endDate: z.string().min(1, "End time is required"),
  address: z.string().min(1, "Location is required"),
  locationType: z.enum(["in_person", "online", "hybrid"]),
  onlineUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  visibility: z.enum(["global", "group-only"]).default("global"),
  image1: z.string().optional(),
  image2: z.string().optional(),
});

export const useCreateEvent = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return { success: false, error: "Unauthorized" };
  }

  const groupSlug = event.params.group_slug;
  const groupContext =
    groupSlug === "global"
      ? { isGlobal: true as const, group: undefined }
      : {
          isGlobal: false as const,
          group: await db.query.groups.findFirst({ where: { slug: groupSlug } }),
        };
  const groupId = groupContext.isGlobal ? null : groupContext.group?.id;

  try {
    await eventsService.create({
      title: data.title,
      body: data.body,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      address: data.address,
      locationType: data.locationType,
      onlineUrl: data.onlineUrl || null,
      visibility: groupContext.isGlobal ? data.visibility : "group-only",
      groupId: groupId as any,
      userId: user.id,
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
            name="body"
            label="Description"
            placeholder="Describe the event..."
            required
          />

          <SmartDatePicker
            startDateName="startDate"
            endDateName="endDate"
            label="Date & Time"
            required
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              name="locationType"
              label="Location Type"
              value={locationType.value}
              onChange$={(e) => {
                locationType.value = (e.target as HTMLSelectElement).value;
              }}
            >
              <option value="in_person">In Person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </Select>
            <Input
              name="address"
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
              required
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
                crop
                cropAspectRatio="1/1"
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
                crop
                cropAspectRatio="1/1"
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
