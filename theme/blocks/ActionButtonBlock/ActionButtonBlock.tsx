import { component$ } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import type { BlockDefinition } from "~/contracts/blocks";

interface ActionButtonBlockProps {
	text?: string;
	href?: string;
	align?: "left" | "center" | "right";
}

export const definition: BlockDefinition = {
	name: "Action Button",
	componentType: "ActionButtonBlock",
	category: "content",
	icon: "🟢",
	configSchema: [
		{
			name: "text",
			label: "Button Text",
			type: "text",
			defaultValue: "Learn More",
			required: true,
		},
		{
			name: "href",
			label: "Link Target",
			type: "url",
			defaultValue: "/",
			required: true,
			placeholder: "/your-target",
		},
		{
			name: "align",
			label: "Alignment",
			type: "select",
			defaultValue: "left",
			options: [
				{ label: "Left", value: "left" },
				{ label: "Center", value: "center" },
				{ label: "Right", value: "right" },
			],
		},
	],
	defaultData: {
		text: "Learn More",
		href: "/",
		align: "left",
	},
};

export default component$<ActionButtonBlockProps>((props) => {
	const text = props.text ?? "Learn More";
	const href = props.href ?? "/";
	const alignClass =
		props.align === "center"
			? "justify-center"
			: props.align === "right"
				? "justify-end"
				: "justify-start";

	return (
		<div class="max-w-6xl mx-auto px-4 py-6">
			<div class={`flex ${alignClass}`}>
				<Button href={href} size="xl">
					{text}
				</Button>
			</div>
		</div>
	);
});
