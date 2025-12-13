import { component$, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { RequestHandler } from '@builder.io/qwik-city';
import { Navigation } from '~/components/ui/Navigation';
import { getCurrentUserData } from '~/utils/server-auth';

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 5,
  });
};

export const useServerTimeLoader = routeLoader$(() => {
  return {
    date: new Date().toISOString(),
  };
});

export const useUserSession = routeLoader$(async (event) => {
  const userData = await getCurrentUserData(event);
  return userData;
});

export default component$(() => {
  return (
    <>
      <Navigation />
      <main class="min-h-screen">
        <Slot />
      </main>
    </>
  );
});
