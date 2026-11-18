import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";

interface SpacerBlockProps {
	height?: number;
}

export const definition: BlockDefinition = {
	name: t("theme.blocks.spacer.spacer"),
	componentType: "SpacerBlock",
	category: "content",
	icon: "↕️",
	configSchema: [
		{
			name: "height",
			label: t("theme.blocks.spacer.heightPixels"),
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
