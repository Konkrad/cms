import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, z, zod$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
import { SmartDatePicker } from "~/components/ui/SmartDatePicker";
import { VisibilitySelector } from "~/components/admin/VisibilitySelector";
import { eventsService } from "~/services/events.service";
import { groupsService } from "~/services/groups.service";
import { getCurrentUserData } from "~/utils/server-auth";

export const useGroupContext = routeLoader$(async ({ params }) => {
  const groupSlug = params.group_slug;
  
  if (groupSlug === "global") {
    return { isGlobal: true, group: null };
  }
  
  const group = await groupsService.getBySlug(groupSlug);
  return { isGlobal: false, group };
});

const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    body: z.string().min(1, "Description is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    salesStartDate: z.string().optional(),
    salesEndDate: z.string().optional(),
    locationType: z.enum(["online", "in_person", "hybrid"]),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    onlineUrl: z.string().url("Please enter a valid URL").optional(),
    visibility: z.enum(["global", "group-only"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.locationType === "in_person" || data.locationType === "hybrid") &&
      !data.address
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Address is required for in-person and hybrid events",
        path: ["address"],
      });
    }

    if (
      (data.locationType === "online" || data.locationType === "hybrid") &&
      !data.onlineUrl
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Online URL is required for online and hybrid events",
        path: ["onlineUrl"],
      });
    }

    if (data.salesStartDate && data.salesEndDate) {
      const salesStart = new Date(data.salesStartDate);
      const salesEnd = new Date(data.salesEndDate);
      if (salesStart >= salesEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sales start date must be before sales end date",
          path: ["salesStartDate"],
        });
      }
    }

    if (data.salesEndDate && data.endDate) {
      const salesEnd = new Date(data.salesEndDate);
      const eventEnd = new Date(data.endDate);
      if (salesEnd > eventEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sales end date must be before or equal to event end date",
          path: ["salesEndDate"],
        });
      }
    }
  });

export const useCreateEvent = routeAction$(async (data, event) => {
  const user = await getCurrentUserData(event as any);
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const groupSlug = event.params.group_slug;
  let groupId: string | null = null;

  // Get group ID if not in global context
  if (groupSlug !== "global") {
    const group = await groupsService.getBySlug(groupSlug);
    if (!group) {
      return { success: false, error: "Group not found" };
    }
    groupId = group.id;
  }

  await eventsService.create({
    title: data.title,
    body: data.body,
    startDate: new Date(data.startDate).toISOString(),
    endDate: new Date(data.endDate).toISOString(),
    salesStartDate: data.salesStartDate ? new Date(data.salesStartDate).toISOString() : null,
    salesEndDate: data.salesEndDate ? new Date(data.salesEndDate).toISOString() : null,
    locationType: data.locationType,
    address: data.address || null,
    city: data.city || null,
    country: data.country || null,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    onlineUrl: data.onlineUrl || null,
    userId: user.id,
    groupId: groupId,
    visibility: data.visibility || "global",
  } as any);

  throw event.redirect(303, `/admin/${groupSlug}/events`);
}, zod$(eventSchema));

export default component$(() => {
  const createEventAction = useCreateEvent();
  const groupContext = useGroupContext();
  const isSubmitting = useSignal(false);
  const locationType = useSignal<"online" | "in_person" | "hybrid">(
    "in_person",
  );

  const latitude = useSignal("");
  const longitude = useSignal("");
  const city = useSignal("");
  const country = useSignal("");

  const showAddress = useComputed$(() => {
    return (
      locationType.value === "in_person" || locationType.value === "hybrid"
    );
  });

  const showOnlineUrl = useComputed$(() => {
    return locationType.value === "online" || locationType.value === "hybrid";
  });

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Event</h2>
        <a href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/events`}>
          <Button variant="secondary">Back to Events</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={createEventAction} class="space-y-6">
          <Input
            name="title"
            label="Title"
            placeholder="Enter event title"
            required
          />

          <TextArea
            name="body"
            label="Description"
            placeholder="Describe your event..."
            rows={4}
            required
          />

          <SmartDatePicker
            startDateName="startDate"
            endDateName="endDate"
            label="Event Date & Time"
            required
          />

          <SmartDatePicker
            startDateName="salesStartDate"
            endDateName="salesEndDate"
            label="Sales Period (Optional)"
            helpText="When can attendees purchase tickets? Leave empty for no restrictions."
          />

          <Select
            name="locationType"
            label="Location Type"
            required
            onChange$={(e) => {
              locationType.value = (e.target as HTMLSelectElement).value as any;
            }}
          >
            <option value="in_person">In Person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </Select>

          {showAddress.value && (
            <AddressAutocomplete
              name="address"
              label="Address"
              placeholder="Start typing an address..."
              required={locationType.value !== "online"}
              latitudeSignal={latitude}
              longitudeSignal={longitude}
              citySignal={city}
              countrySignal={country}
            />
          )}

          {showOnlineUrl.value && (
            <Input
              name="onlineUrl"
              label="Online URL"
              type="url"
              placeholder="https://zoom.us/j/123456789"
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

          {createEventAction.value?.fieldErrors && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {Object.entries(createEventAction.value.fieldErrors).map(
                ([field, errors]) => (
                  <div key={field}>
                    <strong>{field}:</strong>{" "}
                    {Array.isArray(errors) ? errors.join(", ") : errors}
                  </div>
                ),
              )}
            </div>
          )}

          {createEventAction.value?.formErrors && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createEventAction.value.formErrors.join(", ")}
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Creating..." : "Create Event"}
            </Button>
            <a href={`/admin/${groupContext.value.isGlobal ? "global" : groupContext.value.group?.slug}/events`}>
              <Button variant="secondary">Cancel</Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
