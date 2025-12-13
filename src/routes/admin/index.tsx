import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { supabase } from '~/db/connection';

export const useDashboardStats = routeLoader$(async () => {
  const [usersResult, pagesResult, postsResult, eventsResult] =
    await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('pages').select('id', { count: 'exact', head: true }),
      supabase.from('posts').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('id', { count: 'exact', head: true }),
    ]);

  return {
    usersCount: usersResult.count || 0,
    pagesCount: pagesResult.count || 0,
    postsCount: postsResult.count || 0,
    eventsCount: eventsResult.count || 0,
  };
});

export default component$(() => {
  const stats = useDashboardStats();

  return (
    <div>
      <h2 class="text-2xl font-bold mb-6">Dashboard Overview</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-blue-600 mb-3">
              {stats.value.usersCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Users</div>
            <a
              href="/admin/users"
              class="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors font-medium text-sm"
            >
              View All →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-green-600 mb-3">
              {stats.value.postsCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Posts</div>
            <a
              href="/admin/posts"
              class="inline-block px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium text-sm"
            >
              Manage Posts →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-orange-600 mb-3">
              {stats.value.eventsCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Events</div>
            <a
              href="/admin/events"
              class="inline-block px-4 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors font-medium text-sm"
            >
              Manage Events →
            </a>
          </div>
        </Card>

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-slate-600 mb-3">
              {stats.value.pagesCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Pages</div>
            <a
              href="/admin/pages"
              class="inline-block px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors font-medium text-sm"
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
            href="/admin/posts/new"
            class="block px-6 py-8 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-3xl mb-2">+</div>
            <div class="text-lg">Create New Post</div>
          </a>
          <a
            href="/admin/events/new"
            class="block px-6 py-8 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-3xl mb-2">+</div>
            <div class="text-lg">Create New Event</div>
          </a>
          <a
            href="/admin/pages/new"
            class="block px-6 py-8 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-3xl mb-2">+</div>
            <div class="text-lg">Create New Page</div>
          </a>
        </div>
      </Card>
    </div>
  );
});
