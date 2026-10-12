import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";

interface EmbedBlockProps {
	url?: string;
	height?: number;
	title?: string;
}

export const definition: BlockDefinition = {
	name: t("theme.blocks.embed.embed"),
	componentType: "EmbedBlock",
	category: "content",
	icon: "🔗",
	configSchema: [
		{
			name: "url",
			label: t("theme.blocks.embed.embedUrl"),
			type: "url",
			defaultValue: "",
		},
		{
			name: "height",
			label: t("theme.blocks.embed.heightPx"),
			type: "number",
			defaultValue: 400,
		},
		{
			name: "title",
			label: t("theme.blocks.embed.titleAccessibility"),
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
				title={props.title ?? t("theme.embedBlock.embeddedContent")}
				width="100%"
				height={props.height ?? 400}
				class="border border-border w-full"
				loading="lazy"
			/>
		</div>
	);
});
