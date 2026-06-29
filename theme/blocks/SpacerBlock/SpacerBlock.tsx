import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/db/schema";

interface SpacerBlockProps {
	height?: number;
}

export const definition: BlockDefinition = {
	name: "Spacer",
	componentType: "SpacerBlock",
	category: "content",
	icon: "↕️",
	configSchema: [
		{
			name: "height",
			label: "Height (pixels)",
			type: "number",
			defaultValue: 60,
			required: true,
		},
	],
	defaultData: {
		height: 60,
	},
};

export default component$<SpacerBlockProps>((props) => {
	const { height = 60 } = props;

	return <div style={{ height: `${height}px` }} />;
});
