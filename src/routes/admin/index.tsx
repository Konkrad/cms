import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { supabase } from '~/db/connection';

export const useDashboardStats = routeLoader$(async () => {
  const [usersResult, postsResult, eventsResult] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
  ]);

  return {
    usersCount: usersResult.count || 0,
    postsCount: postsResult.count || 0,
    eventsCount: eventsResult.count || 0,
  };
});

export default component$(() => {
  const stats = useDashboardStats();

  return (
    <div>
      <h2 class="text-2xl font-bold mb-6">Dashboard Overview</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <div class="text-center">
            <div class="text-4xl font-bold text-blue-600 mb-2">
              {stats.value.usersCount}
            </div>
            <div class="text-gray-600 text-lg">Total Users</div>
            <a
              href="/admin/users"
              class="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              Manage Users →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center">
            <div class="text-4xl font-bold text-green-600 mb-2">
              {stats.value.postsCount}
            </div>
            <div class="text-gray-600 text-lg">Total Posts</div>
            <a
              href="/admin/posts"
              class="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              Manage Posts →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center">
            <div class="text-4xl font-bold text-purple-600 mb-2">
              {stats.value.eventsCount}
            </div>
            <div class="text-gray-600 text-lg">Total Events</div>
            <a
              href="/admin/events"
              class="mt-4 inline-block text-blue-600 hover:text-blue-800"
            >
              Manage Events →
            </a>
          </div>
        </Card>
      </div>

      <Card>
        <h3 class="text-xl font-semibold mb-4">Quick Actions</h3>
        <div class="space-y-2">
          <a
            href="/posts/new"
            class="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-center"
          >
            Create New Post
          </a>
          <a
            href="/events/new"
            class="block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-center"
          >
            Create New Event
          </a>
        </div>
      </Card>
    </div>
  );
});
