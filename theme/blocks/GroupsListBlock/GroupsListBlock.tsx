import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { useScopesList } from "~/core/content/builder/blocks/useScopesList";
import { ContentCard } from "~theme/shared/ContentCard/ContentCard";

export const definition: BlockDefinition = {
	name: t("theme.blocks.groupsList.groupsList"),
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
					<p class="text-text-muted">
						{t("theme.groupsListBlock.loadingGroups")}
					</p>
				</div>
			) : error.value ? (
				<p class="text-error text-center py-8">
					{t("theme.groupsListBlock.failedToLoadGroups", {
						value: error.value,
					})}
				</p>
			) : groups.value.length === 0 ? (
				<p class="text-text-muted text-center py-8">
					{t("theme.groupsListBlock.noGroupsFound")}
				</p>
			) : (
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{groups.value.map((group) => (
						<ContentCard
							key={group.id}
							title={group.name}
							image={group.imageUrl}
							meta={`${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`}
							href={group.url}
							label={t("theme.groupsListBlock.viewGroup")}
						/>
					))}
				</div>
			)}
		</div>
	);
});
