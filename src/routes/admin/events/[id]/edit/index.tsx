import { component$, useSignal } from '@builder.io/qwik';
import {
  routeAction$,
  routeLoader$,
  Form,
  z,
  zod$,
} from '@builder.io/qwik-city';
import {
  getEventById,
  updateEvent,
  deleteEvent,
} from '~/services/events.service';
import { Input } from '~/components/ui/Input';
import { TextArea } from '~/components/ui/TextArea';
import { Button } from '~/components/ui/Button';
import { LocationAutocomplete } from '~/components/ui/LocationAutocomplete';

export const useEvent = routeLoader$(async (event) => {
  const eventId = event.params.id;
  const eventData = await getEventById(eventId);

  if (!eventData) {
    throw event.redirect(303, '/admin/events');
  }

  return eventData;
});

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  event_date: z.string().min(1, 'Date is required'),
  event_time: z.string().min(1, 'Time is required'),
  location: z.string().min(1, 'Location is required'),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  image_url: z.string().optional(),
});

export const useUpdateEvent = routeAction$(async (data, event) => {
  const eventId = event.params.id;

  const result = await updateEvent(
    eventId,
    {
      title: data.title,
      description: data.description,
      event_date: data.event_date,
      event_time: data.event_time,
      location: data.location,
      city: data.city || null,
      country: data.country || null,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      image_url: data.image_url || null,
    },
    event
  );

  if (result.error) {
    return {
      success: false,
      error: result.error,
    };
  }

  return {
    success: true,
  };
}, zod$(eventSchema));

export const useDeleteEvent = routeAction$(async (data, event) => {
  const eventId = event.params.id;
  await deleteEvent(eventId, event);
  throw event.redirect(303, '/admin/events');
});

export default component$(() => {
  const event = useEvent();
  const updateEventAction = useUpdateEvent();
  const deleteEventAction = useDeleteEvent();
  const isSubmitting = useSignal(false);
  const selectedLocation = useSignal<{
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  } | null>(
    event.value.city && event.value.country
      ? {
          city: event.value.city,
          country: event.value.country,
          latitude: event.value.latitude || 0,
          longitude: event.value.longitude || 0,
        }
      : null
  );

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
            name="description"
            label="Description"
            value={event.value.description}
            placeholder="Describe your event..."
            rows={4}
            required
          />

          <div class="grid grid-cols-2 gap-4">
            <Input
              name="event_date"
              label="Date"
              type="date"
              value={event.value.event_date}
              required
            />
            <Input
              name="event_time"
              label="Time"
              type="time"
              value={event.value.event_time}
              required
            />
          </div>

          <LocationAutocomplete
            name="location"
            label="Location"
            required
            onLocationSelect$={(location) => {
              selectedLocation.value = location;
            }}
          />

          <input
            type="hidden"
            name="city"
            value={selectedLocation.value?.city || event.value.city || ''}
          />
          <input
            type="hidden"
            name="country"
            value={
              selectedLocation.value?.country || event.value.country || ''
            }
          />
          <input
            type="hidden"
            name="latitude"
            value={
              selectedLocation.value?.latitude.toString() ||
              event.value.latitude?.toString() ||
              ''
            }
          />
          <input
            type="hidden"
            name="longitude"
            value={
              selectedLocation.value?.longitude.toString() ||
              event.value.longitude?.toString() ||
              ''
            }
          />

          <Input
            name="image_url"
            label="Image URL (optional)"
            value={event.value.image_url || ''}
            placeholder="https://example.com/image.jpg"
          />

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
