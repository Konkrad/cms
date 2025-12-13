import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { supabase } from '~/db/connection';

export const useDashboardStats = routeLoader$(async () => {
  const [usersResult, postsResult, eventsResult, pagesResult] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
    supabase.from('pages').select('id', { count: 'exact', head: true }),
  ]);

  return {
    usersCount: usersResult.count || 0,
    postsCount: postsResult.count || 0,
    eventsCount: eventsResult.count || 0,
    pagesCount: pagesResult.count || 0,
  };
});

export default component$(() => {
  const stats = useDashboardStats();

  return (
    <div>
      <h2 class="text-2xl font-bold mb-6">Dashboard Overview</h2>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-blue-600 mb-3">
              {stats.value.usersCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Total Users</div>
            <a
              href="/admin/users"
              class="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium"
            >
              Manage Users →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-emerald-600 mb-3">
              {stats.value.postsCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Total Posts</div>
            <a
              href="/admin/posts"
              class="inline-block px-4 py-2 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors font-medium"
            >
              Manage Posts →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-amber-600 mb-3">
              {stats.value.eventsCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Total Events</div>
            <a
              href="/admin/events"
              class="inline-block px-4 py-2 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors font-medium"
            >
              Manage Events →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-purple-600 mb-3">
              {stats.value.pagesCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Total Pages</div>
            <a
              href="/admin/pages"
              class="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors font-medium"
            >
              Manage Pages →
            </a>
          </div>
        </Card>
      </div>

      <Card>
        <h3 class="text-xl font-semibold mb-4">Quick Actions</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/posts/new"
            class="block px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-2xl mb-1">+</div>
            Create New Post
          </a>
          <a
            href="/events/new"
            class="block px-6 py-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-2xl mb-1">+</div>
            Create New Event
          </a>
          <a
            href="/admin/pages/new"
            class="block px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-2xl mb-1">+</div>
            Create New Page
          </a>
        </div>
      </Card>
    </div>
  );
});
