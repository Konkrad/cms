import { component$ } from "@qwik.dev/core";
import type { BlockData } from "~/core/db/schema";
import { disabledBlocks } from "~/core/registry/blocks";
import { blockRegistry } from "~theme/blocks";

interface BlockRendererProps {
	block: BlockData;
}

export const BlockRenderer = component$<BlockRendererProps>((props) => {
	// Blocks of inactive modules render nothing.
	if (disabledBlocks.has(props.block.componentType)) return null;

	const BlockComponent = blockRegistry[props.block.componentType];

	if (!BlockComponent) {
		return (
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
				Failed to load component: {props.block.componentType}
			</div>
		);
	}

	return <BlockComponent {...props.block.data} />;
});
