import { component$, useSignal } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { eventsService } from '~/services/events.service';
import { Card } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { TextArea } from '~/components/ui/TextArea';
import { Select } from '~/components/ui/Select';
import { Button } from '~/components/ui/Button';
import { LocationAutocomplete } from '~/components/ui/LocationAutocomplete';
import type { GeocodingResult } from '~/services/geocoding.service';
import { requireAdmin } from '~/utils/server-auth';

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export const useUsers = routeLoader$(async () => {
  return await usersService.getAll();
});

export const useCreateEvent = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    const accessToken = event.cookie.get('sb-access-token')?.value;

    await eventsService.create({
      title: data.title,
      body: data.body,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      locationType: data.locationType as 'online' | 'in_person' | 'hybrid',
      address: data.address || undefined,
      city: data.city || undefined,
      country: data.country || undefined,
      longitude: data.longitude || undefined,
      latitude: data.latitude || undefined,
      onlineUrl: data.onlineUrl || undefined,
      userId: data.userId,
    }, accessToken);

    throw event.redirect(303, '/events');
  },
  zod$({
    title: z.string().min(1, 'Title is required'),
    body: z.string().min(1, 'Body is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    locationType: z.enum(['online', 'in_person', 'hybrid'], {
      errorMap: () => ({ message: 'Please select a location type' }),
    }),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    longitude: z.string().optional(),
    latitude: z.string().optional(),
    onlineUrl: z.string().optional(),
    userId: z.string().min(1, 'Please select an organizer'),
  })
);

export default component$(() => {
  const users = useUsers();
  const action = useCreateEvent();
  const locationType = useSignal('');
  const selectedLocation = useSignal<GeocodingResult | null>(null);

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Create New Event</h1>

      <Card>
        <Form action={action} class="space-y-6">
          <Select
            name="userId"
            label="Organizer"
            required
            value={action.formData?.get('userId') as string}
            error={action.value?.fieldErrors?.userId?.[0]}
          >
            <option value="">Select an organizer...</option>
            {users.value.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.email})
              </option>
            ))}
          </Select>

          <Input
            name="title"
            label="Title"
            required
            value={action.formData?.get('title') as string}
            error={action.value?.fieldErrors?.title?.[0]}
          />

          <TextArea
            name="body"
            label="Description"
            required
            rows={6}
            value={action.formData?.get('body') as string}
            error={action.value?.fieldErrors?.body?.[0]}
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              name="startDate"
              type="datetime-local"
              label="Start Date & Time"
              required
              value={action.formData?.get('startDate') as string}
              error={action.value?.fieldErrors?.startDate?.[0]}
            />

            <Input
              name="endDate"
              type="datetime-local"
              label="End Date & Time"
              required
              value={action.formData?.get('endDate') as string}
              error={action.value?.fieldErrors?.endDate?.[0]}
            />
          </div>

          <Select
            name="locationType"
            label="Location Type"
            required
            value={action.formData?.get('locationType') as string}
            error={action.value?.fieldErrors?.locationType?.[0]}
            onChange$={(e: any) => {
              locationType.value = e.target.value;
            }}
          >
            <option value="">Select location type...</option>
            <option value="online">Online</option>
            <option value="in_person">In Person</option>
            <option value="hybrid">Hybrid</option>
          </Select>

          {(locationType.value === 'online' || locationType.value === 'hybrid') && (
            <Input
              name="onlineUrl"
              type="url"
              label="Online Meeting URL"
              placeholder="https://..."
              value={action.formData?.get('onlineUrl') as string}
              error={action.value?.fieldErrors?.onlineUrl?.[0]}
            />
          )}

          {(locationType.value === 'in_person' || locationType.value === 'hybrid') && (
            <>
              <LocationAutocomplete
                name="eventLocation"
                label="Event Location"
                searchType="address"
                selectedLocation={selectedLocation}
              />

              <input type="hidden" name="address" value={selectedLocation.value?.fullAddress || ''} />
              <input type="hidden" name="city" value={selectedLocation.value?.city || ''} />
              <input type="hidden" name="country" value={selectedLocation.value?.country || ''} />
              <input type="hidden" name="latitude" value={selectedLocation.value?.latitude.toString() || ''} />
              <input type="hidden" name="longitude" value={selectedLocation.value?.longitude.toString() || ''} />
            </>
          )}

          <div class="flex gap-4">
            <Button type="submit" disabled={action.isRunning}>
              {action.isRunning ? 'Creating...' : 'Create Event'}
            </Button>
            <Button type="button" variant="secondary" onClick$={() => window.history.back()}>
              Cancel
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
});
