import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";

interface EmbedBlockProps {
	url?: string;
	height?: number;
	title?: string;
}

export const definition: BlockDefinition = {
	name: "Embed",
	componentType: "EmbedBlock",
	category: "content",
	icon: "🔗",
	configSchema: [
		{ name: "url", label: "Embed URL", type: "url", defaultValue: "" },
		{ name: "height", label: "Height (px)", type: "number", defaultValue: 400 },
		{
			name: "title",
			label: "Title (accessibility)",
			type: "text",
			required: false,
		},
	],
	defaultData: { url: "", height: 400, title: "" },
};

export default component$<EmbedBlockProps>((props) => {
	if (!props.url) return <div />;

	return (
		<div class="max-w-4xl mx-auto px-4 py-6">
			<iframe
				src={props.url}
				title={props.title ?? "Embedded content"}
				width="100%"
				height={props.height ?? 400}
				class="border border-border w-full"
				loading="lazy"
			/>
		</div>
	);
});
