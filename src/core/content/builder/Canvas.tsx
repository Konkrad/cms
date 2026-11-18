import { $, component$, type QRL } from "@qwik.dev/core";
import type { BlockData, BlockDefinition } from "~/core/db/schema";
import { t } from "~/core/i18n";
import { BlockWrapper } from "./BlockWrapper";

interface CanvasProps {
	blocks: BlockData[];
	selectedBlockId: string | null;
	onSelectBlock: QRL<(blockId: string | null) => void>;
	onDeleteBlock: QRL<(blockId: string) => void>;
	onDuplicateBlock: QRL<(blockId: string) => void>;
	onReorderBlocks: QRL<(blocks: BlockData[]) => void>;
	onMoveBlockUp: QRL<(blockId: string) => void>;
	onMoveBlockDown: QRL<(blockId: string) => void>;
	definitionsMap: Record<string, BlockDefinition>;
}

export const Canvas = component$<CanvasProps>((props) => {
	// Move handlers moved to parent. Parent should provide `onMoveBlockUp` and `onMoveBlockDown` QRLs.
	// This avoids capturing/mutating the `blocks` array in the child component.

	return (
		<div class="flex-1 overflow-y-auto bg-gray-100">
			<div class="max-w-5xl mx-auto py-8">
				{props.blocks.length === 0 ? (
					<div class="bg-white rounded-lg shadow-xs border-2 border-dashed border-gray-300 p-12 text-center">
						<div class="text-6xl mb-4">🎨</div>
						<h3 class="text-xl font-semibold text-gray-700 mb-2">
							{t("admin.canvas.startBuildingYourPage")}
						</h3>
						<p class="text-gray-500">
							{t("admin.canvas.selectAComponentFromThe")}
						</p>
					</div>
				) : (
					<div class="space-y-4">
						{props.blocks
							.slice()
							.sort((a, b) => a.order - b.order)
							.map((block, index) => {
								const blockId = block.id;
								return (
									<BlockWrapper
										key={blockId}
										block={block}
										definition={props.definitionsMap[block.componentType]}
										isSelected={blockId === props.selectedBlockId}
										isFirst={index === 0}
										isLast={index === props.blocks.length - 1}
										onSelect={$(() => props.onSelectBlock(blockId))}
										onDelete={$(() => props.onDeleteBlock(blockId))}
										onDuplicate={$(() => props.onDuplicateBlock(blockId))}
										onMoveUp={$(() => props.onMoveBlockUp(blockId))}
										onMoveDown={$(() => props.onMoveBlockDown(blockId))}
									/>
								);
							})}
					</div>
				)}
			</div>
		</div>
	);
});
