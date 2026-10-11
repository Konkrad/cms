import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { useScopesList } from "~/core/content/builder/blocks/useScopesList";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
	name: "Groups List",
	componentType: "GroupsListBlock",
	category: "dynamic",
	icon: "👥",
	configSchema: [],
	defaultData: {},
};

export default component$(() => {
	// The groups below the scope this page belongs to (the top-level groups on the site root).
	const { scopes: groups, isLoading, error } = useScopesList();

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
							image={group.imageUrl}
							meta={`${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`}
							href={group.url}
							label="View Group"
						/>
					))}
				</div>
			)}
		</div>
	);
});
