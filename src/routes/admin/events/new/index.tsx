import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { createEvent } from '~/services/events.service';
import { Input } from '~/components/ui/Input';
import { TextArea } from '~/components/ui/TextArea';
import { Button } from '~/components/ui/Button';
import { LocationAutocomplete } from '~/components/ui/LocationAutocomplete';

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

export const useCreateEvent = routeAction$(async (data, event) => {
  const result = await createEvent(
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

  throw event.redirect(303, '/admin/events');
}, zod$(eventSchema));

export default component$(() => {
  const createEventAction = useCreateEvent();
  const isSubmitting = useSignal(false);
  const selectedLocation = useSignal<{
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Create New Event</h2>
        <a href="/admin/events">
          <Button variant="secondary">
            Back to Events
          </Button>
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
            name="description"
            label="Description"
            placeholder="Describe your event..."
            rows={4}
            required
          />

          <div class="grid grid-cols-2 gap-4">
            <Input name="event_date" label="Date" type="date" required />
            <Input name="event_time" label="Time" type="time" required />
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
            value={selectedLocation.value?.city || ''}
          />
          <input
            type="hidden"
            name="country"
            value={selectedLocation.value?.country || ''}
          />
          <input
            type="hidden"
            name="latitude"
            value={selectedLocation.value?.latitude.toString() || ''}
          />
          <input
            type="hidden"
            name="longitude"
            value={selectedLocation.value?.longitude.toString() || ''}
          />

          <Input
            name="image_url"
            label="Image URL (optional)"
            placeholder="https://example.com/image.jpg"
          />

          {createEventAction.value?.error && (
            <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {createEventAction.value.error}
            </div>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={isSubmitting.value}>
              {isSubmitting.value ? 'Creating...' : 'Create Event'}
            </Button>
            <a href="/admin/events">
              <Button variant="secondary">
                Cancel
              </Button>
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
});
