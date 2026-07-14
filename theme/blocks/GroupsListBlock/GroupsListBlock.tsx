import { component$, useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { BlockDefinition } from "~/db/schema";
import type { Group } from "~/db/schema";
import { groupsService } from "~/services/groups.service";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";
import { deriveThumbnailKey, publicImageUrlFromKey } from "~/utils/images";

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
          <p class="text-text-muted">Loading groups...</p>
        </div>
      ) : error.value ? (
        <p class="text-error text-center py-8">
          Failed to load groups: {error.value}
        </p>
      ) : groups.value.length === 0 ? (
        <p class="text-text-muted text-center py-8">No groups found.</p>
      ) : (
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.value.map((group) => (
            <ContentCard
              key={group.id}
              title={group.name}
              image={group.image1 ? publicImageUrlFromKey(deriveThumbnailKey(group.image1)) : null}
              meta={`${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`}
              href={`/groups/${group.slug}`}
              label="View Group"
            />
          ))}
        </div>
      )}
    </div>
  );
});
