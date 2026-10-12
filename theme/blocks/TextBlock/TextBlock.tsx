import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";

interface TextBlockProps {
	content?: string;
}

export const definition: BlockDefinition = {
	name: t("theme.blocks.text.textContent"),
	componentType: "TextBlock",
	category: "content",
	icon: "📝",
	configSchema: [
		{
			name: "content",
			label: t("theme.blocks.text.contentHtmlSupported"),
			type: "textarea",
			defaultValue: "<p>Enter your text here...</p>",
			required: true,
		},
	],
	defaultData: {
		content: "<p>Enter your text here...</p>",
	},
};

export default component$<TextBlockProps>((props) => {
	const { content } = props;

	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			<div
				class="prose prose-lg max-w-none"
				dangerouslySetInnerHTML={content || "<p>Enter your text here...</p>"}
			/>
		</div>
	);
});
