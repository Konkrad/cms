import { component$, Slot } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { requireAdmin } from '~/utils/server-auth';

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export default component$(() => {
  return (
    <div class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold mb-2">Admin Area</h1>
        <div class="flex gap-4 border-b pb-4">
          <a
            href="/admin"
            class="px-4 py-2 hover:bg-gray-100 rounded transition-colors"
          >
            Dashboard
          </a>
          <a
            href="/admin/users"
            class="px-4 py-2 hover:bg-gray-100 rounded transition-colors"
          >
            Users
          </a>
          <a
            href="/admin/posts"
            class="px-4 py-2 hover:bg-gray-100 rounded transition-colors"
          >
            Posts
          </a>
          <a
            href="/admin/events"
            class="px-4 py-2 hover:bg-gray-100 rounded transition-colors"
          >
            Events
          </a>
        </div>
      </div>
      <Slot />
    </div>
  );
});
