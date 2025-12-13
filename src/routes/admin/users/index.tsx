import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, Form, z, zod$ } from '@builder.io/qwik-city';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { supabase } from '~/db/connection';
import { createClient } from '@supabase/supabase-js';

const getServiceRoleClient = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const useUsers = routeLoader$(async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any[];
});

export const useUpdateRole = routeAction$(
  async (data) => {
    const client = getServiceRoleClient();
    const { error } = await client
      .from('users')
      .update({ role: data.role })
      .eq('id', data.userId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  },
  zod$({
    userId: z.string(),
    role: z.enum(['admin', 'moderator', 'user']),
  })
);

export const useDeleteUser = routeAction$(
  async (data) => {
    const client = getServiceRoleClient();
    const { error } = await client
      .from('users')
      .delete()
      .eq('id', data.userId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  },
  zod$({
    userId: z.string(),
  })
);

export default component$(() => {
  const users = useUsers();
  const updateRoleAction = useUpdateRole();
  const deleteUserAction = useDeleteUser();

  return (
    <div>
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Manage Users</h2>
      </div>

      {updateRoleAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          Role updated successfully
        </div>
      )}

      {deleteUserAction.value?.success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          User deleted successfully
        </div>
      )}

      {(updateRoleAction.value?.error || deleteUserAction.value?.error) && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {updateRoleAction.value?.error || deleteUserAction.value?.error}
        </div>
      )}

      <Card>
        <div class="overflow-x-auto">
          <table class="w-full">
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {users.value.map((user) => (
                <tr key={user.id}>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {user.display_name}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    {user.email}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <Form action={updateRoleAction} class="inline">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        value={user.role}
                        onChange$={(e) => {
                          const form = (e.target as HTMLSelectElement).closest('form');
                          if (form) form.requestSubmit();
                        }}
                        class="border rounded px-2 py-1 text-sm"
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </Form>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex gap-2">
                      <a
                        href={`/users/${user.id}`}
                        class="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </a>
                      <a
                        href={`/users/${user.id}/edit`}
                        class="text-green-600 hover:text-green-900"
                      >
                        Edit
                      </a>
                      <Form action={deleteUserAction} class="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          class="text-red-600 hover:text-red-900"
                          onClick$={(e) => {
                            if (!confirm('Are you sure you want to delete this user?')) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
});
