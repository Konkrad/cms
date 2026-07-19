import { useSignal, useTask$ } from "@qwik.dev/core";
import { server$ } from "@qwik.dev/router";
import type { GroupListItem } from "~/contracts/groups";
import { groupMembershipsService } from "~/services/group-memberships.service";
import { groupsService } from "~/services/groups.service";

const fetchGroups = server$(async (): Promise<GroupListItem[]> => {
	const allGroups = await groupsService.getAll();

	return Promise.all(
		allGroups.map(async (group) => {
			const memberCount = await groupMembershipsService.countByGroupId(
				group.id,
			);
			return { ...group, memberCount };
		}),
	);
});

/** Headless composable owning data-fetching for the "Groups List" page-builder block. */
export function useGroupsList() {
	const groups = useSignal<GroupListItem[]>([]);
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

	return { groups, isLoading, error };
}
