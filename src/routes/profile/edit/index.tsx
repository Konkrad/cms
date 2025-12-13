import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { getCurrentUserData, requireAuth } from '~/utils/server-auth';
import { supabase } from '~/db/connection';

export const useProfile = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, '/login');
  }

  return userData;
});

export const useUpdateProfile = routeAction$(
  async (data, event) => {
    const user = await requireAuth(event);
    const currentUser = await getCurrentUserData(event);

    if (!currentUser) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const updateData: any = {
      name: data.name,
      family_name: data.family_name,
      display_name: data.display_name,
      city: data.city || null,
      country: data.country || null,
      year_of_birth: data.year_of_birth || null,
      sex: data.sex || null,
    };

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('auth_user_id', user.id);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    throw event.redirect(302, '/profile');
  },
  zod$({
    name: z.string().min(1, 'Name is required'),
    family_name: z.string().min(1, 'Family name is required'),
    display_name: z.string().min(1, 'Display name is required'),
    city: z.string().optional(),
    country: z.string().optional(),
    year_of_birth: z.coerce.number().optional(),
    sex: z.string().optional(),
  })
);

export default component$(() => {
  const profile = useProfile();
  const updateAction = useUpdateProfile();

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <h1 class="text-3xl font-bold mb-6">Edit Profile</h1>

      {updateAction.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {updateAction.value.error}
        </div>
      )}

      <Card>
        <Form action={updateAction} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="name"
              type="text"
              value={profile.value.name}
              required
            />

            <Input
              label="Last Name"
              name="family_name"
              type="text"
              value={profile.value.familyName}
              required
            />

            <Input
              label="Display Name"
              name="display_name"
              type="text"
              value={profile.value.displayName}
              required
              class="md:col-span-2"
            />

            <Input
              label="City"
              name="city"
              type="text"
              value={profile.value.city || ''}
            />

            <Input
              label="Country"
              name="country"
              type="text"
              value={profile.value.country || ''}
            />

            <Input
              label="Year of Birth"
              name="year_of_birth"
              type="number"
              value={profile.value.yearOfBirth?.toString() || ''}
            />

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                name="sex"
                value={profile.value.sex || ''}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <div class="flex gap-4 pt-4">
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
            <a href="/profile">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </a>
          </div>
        </Form>
      </Card>
    </div>
  );
});
