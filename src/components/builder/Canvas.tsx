import { component$, $, type QRL } from '@builder.io/qwik';
import type { BlockData, BlockDefinition } from '~/db/schema';
import { BlockWrapper } from './BlockWrapper';

interface CanvasProps {
  blocks: BlockData[];
  selectedBlockId: string | null;
  onSelectBlock: QRL<(blockId: string | null) => void>;
  onDeleteBlock: QRL<(blockId: string) => void>;
  onDuplicateBlock: QRL<(blockId: string) => void>;
  onReorderBlocks: QRL<(blocks: BlockData[]) => void>;
  definitionsMap: Map<string, BlockDefinition>;
}

export const Canvas = component$<CanvasProps>((props) => {
  const handleMoveUp = $((blockId: string) => {
    const index = props.blocks.findIndex((b) => b.id === blockId);
    if (index <= 0) return;

    const newBlocks = [...props.blocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    props.onReorderBlocks(newBlocks);
  });

  const handleMoveDown = $((blockId: string) => {
    const index = props.blocks.findIndex((b) => b.id === blockId);
    if (index >= props.blocks.length - 1) return;

    const newBlocks = [...props.blocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    props.onReorderBlocks(newBlocks);
  });

  return (
    <div class="flex-1 overflow-y-auto bg-gray-100">
      <div class="max-w-5xl mx-auto py-8">
        {props.blocks.length === 0 ? (
          <div class="bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
            <div class="text-6xl mb-4">🎨</div>
            <h3 class="text-xl font-semibold text-gray-700 mb-2">
              Start Building Your Page
            </h3>
            <p class="text-gray-500">
              Select a component from the sidebar to add it to your page
            </p>
          </div>
        ) : (
          <div class="space-y-4">
            {props.blocks
              .sort((a, b) => a.order - b.order)
              .map((block, index) => (
                <BlockWrapper
                  key={block.id}
                  block={block}
                  definition={props.definitionsMap.get(block.componentType)}
                  isSelected={block.id === props.selectedBlockId}
                  isFirst={index === 0}
                  isLast={index === props.blocks.length - 1}
                  onSelect={() => props.onSelectBlock(block.id)}
                  onDelete={() => props.onDeleteBlock(block.id)}
                  onDuplicate={() => props.onDuplicateBlock(block.id)}
                  onMoveUp={() => handleMoveUp(block.id)}
                  onMoveDown={() => handleMoveDown(block.id)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
});
