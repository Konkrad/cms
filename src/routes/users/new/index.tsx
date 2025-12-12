import { component$, useSignal } from '@builder.io/qwik';
import { routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { Card } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { Select } from '~/components/ui/Select';
import { Button } from '~/components/ui/Button';
import { LocationAutocomplete } from '~/components/ui/LocationAutocomplete';
import type { GeocodingResult } from '~/services/geocoding.service';

export const useCreateUser = routeAction$(
  async (data, { redirect }) => {
    await usersService.create({
      name: data.name,
      familyName: data.familyName,
      email: data.email,
      city: data.city || undefined,
      country: data.country || undefined,
      longitude: data.longitude || undefined,
      latitude: data.latitude || undefined,
      yearOfBirth: data.yearOfBirth ? parseInt(data.yearOfBirth) : undefined,
      sex: data.sex || undefined,
    });

    throw redirect(303, '/users');
  },
  zod$({
    name: z.string().min(1, 'Name is required'),
    familyName: z.string().min(1, 'Family name is required'),
    email: z.string().email('Invalid email address'),
    city: z.string().optional(),
    country: z.string().optional(),
    longitude: z.string().optional(),
    latitude: z.string().optional(),
    yearOfBirth: z.string().optional(),
    sex: z.string().optional(),
  })
);

export default component$(() => {
  const action = useCreateUser();
  const selectedLocation = useSignal<GeocodingResult | null>(null);

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Create New User</h1>

      <Card>
        <Form action={action} class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              name="name"
              label="First Name"
              required
              value={action.formData?.get('name') as string}
              error={action.value?.fieldErrors?.name?.[0]}
            />

            <Input
              name="familyName"
              label="Family Name"
              required
              value={action.formData?.get('familyName') as string}
              error={action.value?.fieldErrors?.familyName?.[0]}
            />
          </div>

          <Input
            name="email"
            type="email"
            label="Email"
            required
            value={action.formData?.get('email') as string}
            error={action.value?.fieldErrors?.email?.[0]}
          />

          <LocationAutocomplete
            name="location"
            label="Location"
            searchType="city"
            selectedLocation={selectedLocation}
          />

          <input type="hidden" name="city" value={selectedLocation.value?.city || ''} />
          <input type="hidden" name="country" value={selectedLocation.value?.country || ''} />
          <input type="hidden" name="latitude" value={selectedLocation.value?.latitude.toString() || ''} />
          <input type="hidden" name="longitude" value={selectedLocation.value?.longitude.toString() || ''} />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              name="yearOfBirth"
              type="number"
              label="Year of Birth"
              value={action.formData?.get('yearOfBirth') as string}
              error={action.value?.fieldErrors?.yearOfBirth?.[0]}
            />

            <Select name="sex" label="Sex" value={action.formData?.get('sex') as string}>
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>

          <div class="flex gap-4">
            <Button type="submit" disabled={action.isRunning}>
              {action.isRunning ? 'Creating...' : 'Create User'}
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
