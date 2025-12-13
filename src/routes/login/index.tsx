import { component$, useSignal, $ } from '@builder.io/qwik';
import { routeLoader$, useNavigate } from '@builder.io/qwik-city';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Card } from '~/components/ui/Card';
import { authService } from '~/services/auth.service';
import { getServerSession } from '~/utils/server-auth';

export const useCheckAuth = routeLoader$(async (event) => {
  const user = await getServerSession(event);
  if (user) {
    throw event.redirect(302, '/');
  }
  return null;
});

export default component$(() => {
  const nav = useNavigate();
  const email = useSignal('');
  const password = useSignal('');
  const error = useSignal('');
  const isLoading = useSignal(false);

  const handleSubmit = $(async () => {
    if (!email.value || !password.value) {
      error.value = 'Please fill in all fields';
      return;
    }

    isLoading.value = true;
    error.value = '';

    try {
      const { session } = await authService.signIn({
        email: email.value,
        password: password.value,
      });

      if (session?.access_token) {
        document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`;
        document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      await nav('/');
    } catch (err: any) {
      error.value = err.message || 'Failed to sign in';
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="container mx-auto px-4 py-8 max-w-md">
      <Card>
        <h1 class="text-3xl font-bold mb-6 text-center">Login</h1>

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
          <Input
            label="Email"
            type="email"
            value={email.value}
            onInput$={(e) => (email.value = (e.target as HTMLInputElement).value)}
            required
            disabled={isLoading.value}
          />

          <Input
            label="Password"
            type="password"
            value={password.value}
            onInput$={(e) => (password.value = (e.target as HTMLInputElement).value)}
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
              {isLoading.value ? 'Signing in...' : 'Login'}
            </Button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-gray-600">
            Don't have an account?{' '}
            <a href="/signup" class="text-blue-600 hover:text-blue-800 font-medium">
              Sign up
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
});
