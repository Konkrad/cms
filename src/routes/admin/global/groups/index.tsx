import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { groupsService } from "~/services/groups.service";

export const useAdminGroups = routeLoader$(async () => {
  return await groupsService.getAll();
});

export default component$(() => {
  const groups = useAdminGroups();

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Community Groups</h2>
        <a
          href="/admin/global/groups/new"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Create New Group
        </a>
      </div>

      {groups.value.length === 0 ? (
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600 mb-4">No groups created yet.</p>
          <a
            href="/admin/global/groups/new"
            class="text-blue-600 hover:text-blue-700 underline"
          >
            Create your first group
          </a>
        </div>
      ) : (
        <div class="grid gap-4">
          {groups.value.map((group) => (
            <div
              key={group.id}
              class="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <h3 class="text-xl font-semibold text-gray-900 mb-2">
                    {group.name}
                  </h3>
                  <p class="text-gray-600 text-sm">
                    Location: {group.latitude}, {group.longitude}
                  </p>
                  <p class="text-gray-500 text-xs mt-1">
                    Created: {new Date(group.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div class="flex gap-2">
                  <a
                    href={`/admin/global/groups/${group.id}/edit`}
                    class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  >
                    Edit
                  </a>
                  <a
                    href={`/admin/global/groups/${group.id}/members`}
                    class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Members
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
