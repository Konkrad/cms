import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { getCurrentUserData } from "~/utils/server-auth";
import { GroupCard } from "~/components/groups/GroupCard";

export const useUserGroups = routeLoader$(async ({ sharedMap, redirect }) => {
  const user = await getCurrentUserData({ sharedMap } as any);

  if (!user) {
    throw redirect(302, "/login");
  }

  const groups = await groupMembershipsService.getUserGroups(user.id);
  return groups;
});

export default component$(() => {
  const groups = useUserGroups();

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">My Groups</h1>
        <p class="text-gray-600">
          Community groups you have joined
        </p>
      </div>

      {groups.value.length === 0 ? (
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600 mb-4">You haven't joined any groups yet.</p>
          <a
            href="/groups"
            class="text-blue-600 hover:text-blue-700 underline font-semibold"
          >
            Browse available groups
          </a>
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
