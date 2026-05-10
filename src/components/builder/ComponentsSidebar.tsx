import { component$, type QRL, useSignal } from "@qwik.dev/core";
import type { BlockDefinition } from "~/db/schema";

interface ComponentsSidebarProps {
	definitions: BlockDefinition[];
	onAddBlock: QRL<(componentType: string) => void>;
}

export const ComponentsSidebar = component$<ComponentsSidebarProps>((props) => {
	const searchQuery = useSignal("");

	const contentBlocks = props.definitions.filter(
		(d) => d.category === "content",
	);
	const dynamicBlocks = props.definitions.filter(
		(d) => d.category === "dynamic",
	);

	const filterBlocks = (blocks: BlockDefinition[]) => {
		if (!searchQuery.value) return blocks;
		const query = searchQuery.value.toLowerCase();
		return blocks.filter(
			(b) =>
				b.name.toLowerCase().includes(query) ||
				b.category.toLowerCase().includes(query),
		);
	};

	const filteredContentBlocks = filterBlocks(contentBlocks);
	const filteredDynamicBlocks = filterBlocks(dynamicBlocks);

	return (
		<div class="w-64 bg-white border-r border-gray-200 flex flex-col">
			<div class="p-4 border-b border-gray-200">
				<h2 class="text-sm font-semibold text-gray-900 mb-3">Components</h2>
				<input
					type="text"
					placeholder="Search components..."
					class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
					value={searchQuery.value}
					onInput$={(e) => {
						searchQuery.value = (e.target as HTMLInputElement).value;
					}}
				/>
			</div>

			<div class="flex-1 overflow-y-auto p-4 space-y-6">
				{filteredContentBlocks.length > 0 && (
					<div>
						<h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
							Content Blocks
						</h3>
						<div class="space-y-2">
							{filteredContentBlocks.map((definition) => (
								<button
									key={definition.componentType}
									type="button"
									class="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
									onClick$={() => props.onAddBlock(definition.componentType)}
									data-component-type={definition.componentType}
								>
									<div class="flex items-center gap-2">
										<span class="text-2xl">{definition.icon}</span>
										<div class="flex-1">
											<div class="font-medium text-sm text-gray-900">
												{definition.name}
											</div>
										</div>
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				{filteredDynamicBlocks.length > 0 && (
					<div>
						<h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
							Dynamic Blocks
						</h3>
						<div class="space-y-2">
							{filteredDynamicBlocks.map((definition) => (
								<button
									key={definition.componentType}
									type="button"
									class="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
									onClick$={() => props.onAddBlock(definition.componentType)}
									data-component-type={definition.componentType}
								>
									<div class="flex items-center gap-2">
										<span class="text-2xl">{definition.icon}</span>
										<div class="flex-1">
											<div class="font-medium text-sm text-gray-900">
												{definition.name}
											</div>
										</div>
									</div>
								</button>
							))}
						</div>
					</div>
				)}

				{filteredContentBlocks.length === 0 &&
					filteredDynamicBlocks.length === 0 && (
						<div class="text-center py-8 text-gray-500 text-sm">
							No components found
						</div>
					)}
			</div>
		</div>
	);
});
