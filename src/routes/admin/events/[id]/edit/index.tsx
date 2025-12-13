import { component$, useSignal } from '@builder.io/qwik';
import {
  routeAction$,
  routeLoader$,
  Form,
  z,
  zod$,
} from '@builder.io/qwik-city';
import { eventsService } from '~/services/events.service';
import { Input } from '~/components/ui/Input';
import { TextArea } from '~/components/ui/TextArea';
import { Button } from '~/components/ui/Button';
import { Select } from '~/components/ui/Select';

export const useEvent = routeLoader$(async (event) => {
  const eventId = event.params.id;
  const eventData = await eventsService.getById(eventId);

  if (!eventData) {
    throw event.redirect(303, '/admin/events');
  }

  return eventData;
});

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Description is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  locationType: z.enum(['online', 'in_person', 'hybrid']),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  onlineUrl: z.string().optional(),
});

export const useUpdateEvent = routeAction$(async (data, event) => {
  const eventId = event.params.id;

  try {
    await eventsService.update(
      eventId,
      {
        title: data.title,
        body: data.body,
        startDate: data.startDate,
        endDate: data.endDate,
        locationType: data.locationType,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        onlineUrl: data.onlineUrl || null,
      }
    );

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update event',
    };
  }
}, zod$(eventSchema));

export const useDeleteEvent = routeAction$(async (data, event) => {
  const eventId = event.params.id;
  await eventsService.delete(eventId);
  throw event.redirect(303, '/admin/events');
});

export default component$(() => {
  const event = useEvent();
  const updateEventAction = useUpdateEvent();
  const deleteEventAction = useDeleteEvent();
  const isSubmitting = useSignal(false);

  const formatDatetimeLocal = (isoString: string) => {
    if (!isoString) return '';
    return isoString.slice(0, 16);
  };

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Edit Event</h2>
        <a href="/admin/events">
          <Button variant="secondary">
            Back to Events
          </Button>
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

          <div class="grid grid-cols-2 gap-4">
            <Input
              name="startDate"
              label="Start Date & Time"
              type="datetime-local"
              value={formatDatetimeLocal(event.value.startDate)}
              required
            />
            <Input
              name="endDate"
              label="End Date & Time"
              type="datetime-local"
              value={formatDatetimeLocal(event.value.endDate)}
              required
            />
          </div>

          <Select
            name="locationType"
            label="Location Type"
            value={event.value.locationType}
            required
          >
            <option value="in_person">In Person</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </Select>

          <Input
            name="address"
            label="Address (for in-person events)"
            value={event.value.address || ''}
            placeholder="Enter physical address"
          />

          <Input
            name="onlineUrl"
            label="Online URL (for online events)"
            value={event.value.onlineUrl || ''}
            placeholder="https://zoom.us/..."
          />

          <div class="grid grid-cols-2 gap-4">
            <Input
              name="city"
              label="City"
              value={event.value.city || ''}
              placeholder="City"
            />
            <Input
              name="country"
              label="Country"
              value={event.value.country || ''}
              placeholder="Country"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <Input
              name="latitude"
              label="Latitude"
              type="number"
              step="any"
              value={event.value.latitude?.toString() || ''}
              placeholder="0.0"
            />
            <Input
              name="longitude"
              label="Longitude"
              type="number"
              step="any"
              value={event.value.longitude?.toString() || ''}
              placeholder="0.0"
            />
          </div>

          {updateEventAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {updateEventAction.value.error}
            </div>
          )}

          {updateEventAction.value?.success && (
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Event updated successfully!
            </div>
          )}

          <div class="flex justify-between">
            <div class="flex gap-4">
              <Button type="submit" disabled={isSubmitting.value}>
                {isSubmitting.value ? 'Saving...' : 'Save Changes'}
              </Button>
              <a href="/admin/events">
                <Button variant="secondary">
                  Cancel
                </Button>
              </a>
            </div>

            <Form action={deleteEventAction}>
              <Button
                type="submit"
                variant="secondary"
                class="text-red-600 hover:bg-red-50"
                onClick$={(e) => {
                  if (
                    !confirm('Are you sure you want to delete this event?')
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                Delete Event
              </Button>
            </Form>
          </div>
        </Form>
      </div>
    </div>
  );
});
