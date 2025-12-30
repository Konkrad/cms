import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { groupsService } from "~/services/groups.service";
import { GroupCard } from "~/components/groups/GroupCard";

export const useGroups = routeLoader$(async () => {
  return await groupsService.getAll();
});

export default component$(() => {
  const groups = useGroups();

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">Community Groups</h1>
        <p class="text-gray-600">
          Join a local community group to connect with others and access group-specific content.
        </p>
      </div>

      {groups.value.length === 0 ? (
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600">No groups available yet.</p>
        </div>
      ) : (
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.value.map((group) => (
            <a key={group.id} href={`/groups/${group.slug}`}>
              <GroupCard group={group} showActions={true} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
});
