import { component$ } from "@qwik.dev/core";
import type { BlockData } from "~/core/db/schema";
import { t } from "~/core/i18n";
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
				{t("admin.blockRenderer.failedToLoadComponent", {
					componentType: props.block.componentType,
				})}
			</div>
		);
	}

	return <BlockComponent {...props.block.data} />;
});
