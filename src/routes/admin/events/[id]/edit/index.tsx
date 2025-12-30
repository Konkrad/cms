import {
  component$,
  useSignal,
  useComputed$,
  useTask$,
} from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { AddressAutocomplete } from "~/components/ui/AddressAutocomplete";
import { SmartDatePicker } from "~/components/ui/SmartDatePicker";
import { eventsService } from "~/services/events.service";

export const useEvent = routeLoader$(async (event) => {
  const eventId = event.params.id;
  const eventData = await eventsService.getById(eventId);

  if (!eventData) {
    throw event.redirect(303, "/admin/events");
  }

  return eventData;
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
  })
  .superRefine((data, ctx) => {
    // Validate address is provided for in_person or hybrid events
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

    // Validate online URL is provided for online or hybrid events
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

    // Validate sales period dates
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

export const useUpdateEvent = routeAction$(async (data, event) => {
  const eventId = event.params.id;

  await eventsService.update(eventId, {
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
  } as any);

  return {
    success: true,
  };
}, zod$(eventSchema));

export default component$(() => {
  const event = useEvent();
  const updateEventAction = useUpdateEvent();

  const isSubmitting = useSignal(false);
  const locationType = useSignal<"online" | "in_person" | "hybrid">(
    event.value.locationType as "online" | "in_person" | "hybrid",
  );

  // Geocoding state
  const latitude = useSignal(event.value.latitude?.toString() || "");
  const longitude = useSignal(event.value.longitude?.toString() || "");
  const city = useSignal(event.value.city || "");
  const country = useSignal(event.value.country || "");

  // Update location type when event data changes
  useTask$(({ track }) => {
    track(() => event.value);
    locationType.value = event.value.locationType as
      | "online"
      | "in_person"
      | "hybrid";
  });

  // Computed visibility flags
  const showAddress = useComputed$(() => {
    return (
      locationType.value === "in_person" || locationType.value === "hybrid"
    );
  });

  const showOnlineUrl = useComputed$(() => {
    return locationType.value === "online" || locationType.value === "hybrid";
  });

  const formatDatetimeLocal = (isoString: string) => {
    if (!isoString) return "";
    return isoString.slice(0, 16);
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Event</h2>
        <a href="/admin/events">
          <Button variant="secondary">Back to Events</Button>
        </a>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <Form action={updateEventAction} class="space-y-6">
          <Input
            name="title"
            label="Title"
            value={event.value.title}
            placeholder="Enter event title"
            required
          />

          <TextArea
            name="body"
            label="Description"
            value={event.value.body}
            placeholder="Describe your event..."
            rows={4}
            required
          />

          <SmartDatePicker
            startDateName="startDate"
            endDateName="endDate"
            label="Event Date & Time"
            required
            startValue={event.value.startDate}
            endValue={event.value.endDate}
          />

          <SmartDatePicker
            startDateName="salesStartDate"
            endDateName="salesEndDate"
            label="Sales Period (Optional)"
            startValue={event.value.salesStartDate || undefined}
            endValue={event.value.salesEndDate || undefined}
            helpText="When can attendees purchase tickets? Leave empty for no restrictions."
          />

          <Select
            name="locationType"
            label="Location Type"
            value={event.value.locationType}
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
              value={event.value.address || ""}
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
              value={event.value.onlineUrl || ""}
              placeholder="https://zoom.us/j/123456789"
              required={locationType.value !== "in_person"}
            />
          )}

          {updateEventAction.value?.fieldErrors && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {Object.entries(updateEventAction.value.fieldErrors).map(
                ([field, errors]) => (
                  <div key={field}>
                    <strong>{field}:</strong>{" "}
                    {Array.isArray(errors) ? errors.join(", ") : errors}
                  </div>
                ),
              )}
            </div>
          )}

          {updateEventAction.value?.formErrors && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {updateEventAction.value.formErrors.join(", ")}
            </div>
          )}

          {updateEventAction.value?.success && (
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Event updated successfully!
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? "Saving..." : "Save Changes"}
            </Button>
            <a href="/admin/events">
              <Button variant="secondary">Cancel</Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
