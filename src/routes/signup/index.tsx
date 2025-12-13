import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate } from '@builder.io/qwik-city';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Card } from '~/components/ui/Card';
import { LocationAutocomplete } from '~/components/ui/LocationAutocomplete';
import { authService } from '~/services/auth.service';
import { getServerSession } from '~/utils/server-auth';
import type { GeocodingResult } from '~/services/geocoding.service';

export const useCheckAuth = routeLoader$(async (event) => {
  const user = await getServerSession(event);
  if (user) {
    throw event.redirect(302, '/');
  }
  return null;
});

export default component$(() => {
  const nav = useNavigate();
  const name = useSignal('');
  const familyName = useSignal('');
  const email = useSignal('');
  const password = useSignal('');
  const confirmPassword = useSignal('');
  const selectedLocation = useSignal<GeocodingResult | null>(null);
  const yearOfBirth = useSignal('');
  const sex = useSignal('');
  const error = useSignal('');
  const isLoading = useSignal(false);

  const handleSubmit = $(async () => {
    if (!name.value || !familyName.value || !email.value || !password.value || !confirmPassword.value) {
      error.value = 'Please fill in all required fields';
      return;
    }

    if (!selectedLocation.value) {
      error.value = 'Please select your city';
      return;
    }

    if (!yearOfBirth.value) {
      error.value = 'Please enter your year of birth';
      return;
    }

    if (!sex.value) {
      error.value = 'Please select your gender';
      return;
    }

    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match';
      return;
    }

    if (password.value.length < 6) {
      error.value = 'Password must be at least 6 characters';
      return;
    }

    const year = parseInt(yearOfBirth.value);
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear - 13) {
      error.value = 'Please enter a valid year of birth (must be at least 13 years old)';
      return;
    }

    isLoading.value = true;
    error.value = '';

    try {
      const { session } = await authService.signUp({
        email: email.value,
        password: password.value,
        name: name.value,
        family_name: familyName.value,
        city: selectedLocation.value.city,
        country: selectedLocation.value.country,
        latitude: selectedLocation.value.latitude,
        longitude: selectedLocation.value.longitude,
        year_of_birth: year,
        sex: sex.value,
      });

      if (session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`;
        document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      await nav('/');
    } catch (err: any) {
      error.value = err.message || 'Failed to sign up';
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <h1 class="text-3xl font-bold mb-6 text-center">Sign Up</h1>

        {error.value && (
          <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error.value}
          </div>
        )}

        <form
          preventdefault:submit
          onSubmit$={handleSubmit}
          class="space-y-4"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              type="text"
              value={name.value}
              onInput$={(e) => (name.value = (e.target as HTMLInputElement).value)}
              required
              disabled={isLoading.value}
            />

            <Input
              label="Last Name"
              type="text"
              value={familyName.value}
              onInput$={(e) => (familyName.value = (e.target as HTMLInputElement).value)}
              required
              disabled={isLoading.value}
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={email.value}
            onInput$={(e) => (email.value = (e.target as HTMLInputElement).value)}
            required
            disabled={isLoading.value}
          />

          <LocationAutocomplete
            name="city"
            label="City"
            searchType="city"
            selectedLocation={selectedLocation}
            required
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Year of Birth"
              type="number"
              value={yearOfBirth.value}
              onInput$={(e) => (yearOfBirth.value = (e.target as HTMLInputElement).value)}
              required
              disabled={isLoading.value}
              min="1900"
              max={new Date().getFullYear() - 13}
            />

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-gray-700">
                Gender
                <span class="text-red-500 ml-1">*</span>
              </label>
              <select
                value={sex.value}
                onChange$={(e) => (sex.value = (e.target as HTMLSelectElement).value)}
                required
                disabled={isLoading.value}
                class="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white border-gray-300"
              >
                <option value="">Select gender...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          <Input
            label="Password"
            type="password"
            value={password.value}
            onInput$={(e) => (password.value = (e.target as HTMLInputElement).value)}
            required
            disabled={isLoading.value}
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword.value}
            onInput$={(e) => (confirmPassword.value = (e.target as HTMLInputElement).value)}
            required
            disabled={isLoading.value}
          />

          <div class="flex gap-4">
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading.value}
              class="flex-1"
            >
              {isLoading.value ? 'Creating account...' : 'Sign Up'}
            </Button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-gray-600">
            Already have an account?{' '}
            <a href="/login" class="text-blue-600 hover:text-blue-800 font-medium">
              Login
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
});
