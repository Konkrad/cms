import { component$, Slot } from '@builder.io/qwik';
import { routeLoader$, useLocation } from '@builder.io/qwik-city';
import { requireAdmin } from '~/utils/server-auth';

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export default component$(() => {
  const location = useLocation();
  const currentPath = location.url.pathname;

  return (
    <div class="min-h-screen bg-gray-50">
      <div class="bg-slate-800 text-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-6">
          <div class="flex items-center justify-between mb-4">
            <h1 class="text-3xl font-bold">Admin Area</h1>
            <a
              href="/"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-sm"
            >
              Back to Site
            </a>
          </div>
          <nav class="flex gap-2">
            <a
              href="/admin"
              class={`px-4 py-2 rounded transition-colors ${
                currentPath === '/admin' || currentPath === '/admin/'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Dashboard
            </a>
            <a
              href="/admin/users"
              class={`px-4 py-2 rounded transition-colors ${
                currentPath.startsWith('/admin/users')
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Users
            </a>
            <a
              href="/admin/posts"
              class={`px-4 py-2 rounded transition-colors ${
                currentPath.startsWith('/admin/posts')
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Posts
            </a>
            <a
              href="/admin/pages"
              class={`px-4 py-2 rounded transition-colors ${
                currentPath.startsWith('/admin/pages')
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Pages
            </a>
            <a
              href="/admin/events"
              class={`px-4 py-2 rounded transition-colors ${
                currentPath.startsWith('/admin/events')
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Events
            </a>
          </nav>
        </div>
      </div>
      <div class="max-w-7xl mx-auto px-4 py-8">
        <Slot />
      </div>
    </div>
  );
});
