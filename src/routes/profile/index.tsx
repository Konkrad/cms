import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { getCurrentUserData, requireAuth } from '~/utils/server-auth';

export const useProfile = routeLoader$(async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, '/login');
  }

  return userData;
});

export default component$(() => {
  const profile = useProfile();

  return (
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">My Profile</h1>
        <a href="/profile/edit">
          <Button variant="primary">Edit Profile</Button>
        </a>
      </div>

      <Card>
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                First Name
              </label>
              <p class="text-lg">{profile.value.name}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                Last Name
              </label>
              <p class="text-lg">{profile.value.family_name}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                Display Name
              </label>
              <p class="text-lg">{profile.value.display_name}</p>
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                Email
              </label>
              <p class="text-lg">{profile.value.email}</p>
            </div>

            {profile.value.city && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  City
                </label>
                <p class="text-lg">{profile.value.city}</p>
              </div>
            )}

            {profile.value.country && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  Country
                </label>
                <p class="text-lg">{profile.value.country}</p>
              </div>
            )}

            {profile.value.year_of_birth && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  Year of Birth
                </label>
                <p class="text-lg">{profile.value.year_of_birth}</p>
              </div>
            )}

            {profile.value.sex && (
              <div>
                <label class="text-sm font-medium text-gray-700 block mb-1">
                  Gender
                </label>
                <p class="text-lg">{profile.value.sex}</p>
              </div>
            )}

            <div>
              <label class="text-sm font-medium text-gray-700 block mb-1">
                Role
              </label>
              <p class="text-lg capitalize">{profile.value.role.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});
