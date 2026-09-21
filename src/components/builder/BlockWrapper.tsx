import {
	component$,
	type QRL,
	type Signal,
	useSignal,
	useTask$,
} from "@qwik.dev/core";
import type { BlockData, BlockDefinition } from "~/db/schema";
import { componentLoaderService } from "~/services/component-loader.service";

interface BlockWrapperProps {
	block: BlockData;
	definition?: BlockDefinition;
	isSelected: boolean;
	isFirst: boolean;
	isLast: boolean;
	onSelect: QRL<() => void>;
	onDelete: QRL<() => void>;
	onDuplicate: QRL<() => void>;
	onMoveUp: QRL<() => void>;
	onMoveDown: QRL<() => void>;
	s3BaseUrl: string;
}

export const BlockWrapper = component$<BlockWrapperProps>((props) => {
	const BlockComponent: Signal<any> = useSignal(null);
	const loadError = useSignal<string | null>(null);

	console.log("[BlockWrapper] render - block:", {
		id: props.block.id,
		componentType: props.block.componentType,
		selected: props.isSelected,
	});

	useTask$(async ({ track }) => {
		track(() => props.block.componentType);
		loadError.value = null;
		try {
			console.log(
				`[BlockWrapper] loading component ${props.block.componentType}`,
				{ blockId: props.block.id },
			);
			const Component = await componentLoaderService.loadComponent(
				props.block.componentType,
			);
			BlockComponent.value = Component;
			console.log(
				`[BlockWrapper] loaded component ${props.block.componentType}`,
				{ blockId: props.block.id },
			);
		} catch (error: any) {
			const msg = error?.message ?? String(error);
			loadError.value = msg;
			console.error(
				`[BlockWrapper] Failed to load component ${props.block.componentType}:`,
				error,
			);
		}
	});

	return (
		<div
			class={`relative group bg-white rounded-lg shadow-xs transition-all ${
				props.isSelected
					? "ring-2 ring-blue-500 shadow-lg"
					: "hover:ring-2 hover:ring-gray-300"
			}`}
			onClick$={props.onSelect}
		>
			<div
				class={`absolute top-2 left-2 right-2 flex items-center justify-between bg-gray-900 bg-opacity-90 text-white px-3 py-2 rounded text-xs font-medium transition-opacity ${
					props.isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
				}`}
			>
				<div class="flex items-center gap-2">
					<span>{props.definition?.icon || "📦"}</span>
					<span>{props.definition?.name || props.block.componentType}</span>
				</div>
				<div class="flex items-center gap-1">
					{!props.isFirst && (
						<button
							type="button"
							class="px-2 py-1 hover:bg-gray-700 rounded-sm transition-colors"
							onClick$={(e) => {
								e.stopPropagation();
								props.onMoveUp();
							}}
							title="Move Up"
						>
							↑
						</button>
					)}
					{!props.isLast && (
						<button
							type="button"
							class="px-2 py-1 hover:bg-gray-700 rounded-sm transition-colors"
							onClick$={(e) => {
								e.stopPropagation();
								props.onMoveDown();
							}}
							title="Move Down"
						>
							↓
						</button>
					)}
					<button
						type="button"
						class="px-2 py-1 hover:bg-gray-700 rounded-sm transition-colors"
						onClick$={(e) => {
							e.stopPropagation();
							props.onDuplicate();
						}}
						title="Duplicate"
					>
						📋
					</button>
					<button
						type="button"
						class="px-2 py-1 hover:bg-red-600 rounded-sm transition-colors"
						onClick$={(e) => {
							e.stopPropagation();
							if (confirm("Delete this block?")) {
								props.onDelete();
							}
						}}
						title="Delete"
					>
						🗑️
					</button>
				</div>
			</div>

			<div class="pointer-events-none">
				{loadError.value ? (
					<div class="p-4 text-sm text-red-600">
						Failed to load component {props.block.componentType}:{" "}
						{loadError.value}
					</div>
				) : BlockComponent.value ? (
					<BlockComponent.value
						{...props.block.data}
						s3BaseUrl={props.s3BaseUrl}
					/>
				) : (
					<div class="text-sm text-gray-400">
						Loading {props.block.componentType}...
					</div>
				)}
			</div>
		</div>
	);
});
