import { component$ } from "@qwik.dev/core";
import type { BlockData } from "~/db/schema";
import { blockRegistry } from "~theme/blocks";

interface BlockRendererProps {
	block: BlockData;
	s3BaseUrl: string;
}

export const BlockRenderer = component$<BlockRendererProps>((props) => {
	const BlockComponent = blockRegistry[props.block.componentType];

	if (!BlockComponent) {
		return (
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
				Failed to load component: {props.block.componentType}
			</div>
		);
	}

	return <BlockComponent {...props.block.data} s3BaseUrl={props.s3BaseUrl} />;
});
