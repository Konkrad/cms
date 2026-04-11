import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { groupsService } from "~/services/groups.service";

export const useAdminGroups = routeLoader$(async ({ params, redirect }) => {
  const groupSlug = params.group_slug;
  // This page is only valid in the global admin context
  if (groupSlug !== "global") {
    throw redirect(302, `/admin/${groupSlug}`);
  }

  const items = await groupsService.getAll();
  return { groups: items };
});

export default component$(() => {
  const data = useAdminGroups();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Manage Groups</h2>
        <Button href="/admin/global/groups/new">Create New Group</Button>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {data.value.groups.map((group) => (
              <tr key={group.id} class="hover:bg-gray-50">
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{group.name}</div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">{group.slug}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {group.latitude}, {group.longitude}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {new Date(group.createdAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 text-sm font-medium">
                  <div class="flex items-center gap-4">
                    <a
                      href={`/admin/global/groups/${group.id}/edit`}
                      class="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </a>
                    <a
                      href={`/admin/global/groups/${group.id}/members`}
                      class="text-gray-600 hover:text-gray-900"
                    >
                      Members
                    </a>
                    <a
                      href={`/groups/${group.slug}`}
                      class="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.value.groups.length === 0 && (
          <div class="text-center py-12 text-gray-500">
            No groups found. Create your first group.
          </div>
        )}
      </div>
    </div>
  );
});
