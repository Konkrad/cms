import { component$, useSignal, useTask$ } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";
import type { BlockDefinition } from "~/db/schema";
import type { Group } from "~/db/schema";
import { GroupCard } from "./GroupCard";

export const definition: BlockDefinition = {
  name: "Groups List",
  componentType: "GroupsListBlock",
  category: "dynamic",
  icon: "👥",
  configSchema: [],
  defaultData: {},
};

interface GroupWithMemberCount extends Group {
  memberCount: number;
}

const fetchGroups = server$(async (): Promise<GroupWithMemberCount[]> => {
  const { groupsService } = await import("~/services/groups.service");
  const { groupMembershipsService } = await import(
    "~/services/group-memberships.service"
  );

  const allGroups = await groupsService.getAll();

  const results = await Promise.all(
    allGroups.map(async (group) => {
      const memberCount = await groupMembershipsService.countByGroupId(
        group.id,
      );
      return { ...group, memberCount };
    }),
  );

  return results;
});

export default component$(() => {
  const groups = useSignal<GroupWithMemberCount[]>([]);
  const isLoading = useSignal(true);
  const error = useSignal<string | null>(null);

  useTask$(async () => {
    try {
      groups.value = await fetchGroups();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to load groups";
    } finally {
      isLoading.value = false;
    }
  });

  return (
    <div class="max-w-6xl mx-auto px-4 py-12">
      {isLoading.value ? (
        <div class="text-center py-12">
          <p class="text-gray-500">Loading groups...</p>
        </div>
      ) : error.value ? (
        <p class="text-red-500 text-center py-8">
          Failed to load groups: {error.value}
        </p>
      ) : groups.value.length === 0 ? (
        <p class="text-gray-500 text-center py-8">No groups found.</p>
      ) : (
        <div class="flex flex-col gap-6">
          {groups.value.map((group) => (
            <GroupCard
              key={group.id}
              name={group.name}
              memberCount={group.memberCount}
              image={group.image1}
              readMoreHref={`/groups/${group.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});
