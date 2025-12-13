import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';

console.log('[Admin Users] Module loading - importing date-fns');
import { format } from 'date-fns';
console.log('[Admin Users] Module loading - date-fns format imported, type:', typeof format);

export const useUsers = routeLoader$(async () => {
  console.log('[Admin Users] useUsers - starting');
  const users = await usersService.getAll();
  console.log('[Admin Users] useUsers - completed, users count:', users.length);
  console.log('[Admin Users] useUsers - first user created_at type:', users[0] ? typeof users[0].createdAt : 'no users');
  return users;
});

export default component$(() => {
  console.log('[Admin Users] Component rendering - start');
  const users = useUsers();
  console.log('[Admin Users] Component rendering - users value:', users.value.length);

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Users</h2>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {users.value.map((user) => (
              <tr key={user.id} class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {user.displayName}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{user.email}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.city && user.country
                    ? `${user.city}, ${user.country}`
                    : '-'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {(() => {
                    try {
                      console.log('[Admin Users] Formatting date for user:', user.id, 'createdAt:', user.createdAt, 'type:', typeof user.createdAt);
                      const date = new Date(user.createdAt);
                      console.log('[Admin Users] Date object created:', date, 'isValid:', !isNaN(date.getTime()));
                      const formatted = format(date, 'MMM d, yyyy');
                      console.log('[Admin Users] Date formatted successfully:', formatted);
                      return formatted;
                    } catch (error) {
                      console.error('[Admin Users] Error formatting date:', error);
                      return user.createdAt;
                    }
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.value.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
});
