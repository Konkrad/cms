import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { supabase } from '~/db/connection';

export const useDashboardStats = routeLoader$(async () => {
  const [usersResult, pagesResult, menuItemsResult] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('pages').select('id', { count: 'exact', head: true }),
    supabase.from('menu_items').select('id', { count: 'exact', head: true }),
  ]);

  return {
    usersCount: usersResult.count || 0,
    pagesCount: pagesResult.count || 0,
    menuItemsCount: menuItemsResult.count || 0,
  };
});

export default component$(() => {
  const stats = useDashboardStats();

  return (
    <div>
      <h2 class="text-2xl font-bold mb-6">Dashboard Overview</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-blue-600 mb-3">
              {stats.value.usersCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Total Users</div>
            <div class="text-sm text-gray-500">Registered community members</div>
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

        <Card>
          <div class="text-center p-4">
            <div class="text-5xl font-bold text-emerald-600 mb-3">
              {stats.value.menuItemsCount}
            </div>
            <div class="text-gray-700 text-lg font-medium mb-4">Menu Items</div>
            <div class="text-sm text-gray-500">Items in navigation</div>
          </div>
        </Card>
      </div>

      <Card>
        <h3 class="text-xl font-semibold mb-4">Quick Actions</h3>
        <div class="flex justify-center">
          <a
            href="/admin/pages/new"
            class="block px-8 py-6 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center font-medium shadow-md hover:shadow-lg"
          >
            <div class="text-3xl mb-2">+</div>
            <div class="text-lg">Create New Page</div>
          </a>
        </div>
      </Card>
    </div>
  );
});
