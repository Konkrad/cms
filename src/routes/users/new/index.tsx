import { component$ } from '@builder.io/qwik';
import { routeAction$, Form, zod$, z } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { Card } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { Select } from '~/components/ui/Select';
import { Button } from '~/components/ui/Button';

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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              name="city"
              label="City"
              value={action.formData?.get('city') as string}
              error={action.value?.fieldErrors?.city?.[0]}
            />

            <Input
              name="country"
              label="Country"
              value={action.formData?.get('country') as string}
              error={action.value?.fieldErrors?.country?.[0]}
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              name="latitude"
              type="number"
              step="any"
              label="Latitude"
              value={action.formData?.get('latitude') as string}
              error={action.value?.fieldErrors?.latitude?.[0]}
            />

            <Input
              name="longitude"
              type="number"
              step="any"
              label="Longitude"
              value={action.formData?.get('longitude') as string}
              error={action.value?.fieldErrors?.longitude?.[0]}
            />
          </div>

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
