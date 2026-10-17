import { component$ } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";

interface ActionButtonBlockProps {
	text?: string;
	href?: string;
	align?: "left" | "center" | "right";
}

export const definition: BlockDefinition = {
	name: t("theme.blocks.actionButton.actionButton"),
	componentType: "ActionButtonBlock",
	category: "content",
	icon: "🟢",
	configSchema: [
		{
			name: "text",
			label: t("theme.blocks.actionButton.buttonText"),
			type: "text",
			defaultValue: t("theme.blocks.actionButton.learnMore"),
			required: true,
		},
		{
			name: "href",
			label: t("theme.blocks.actionButton.linkTarget"),
			// A page, group or item picked as a reference (follows renames), or an external URL.
			type: "link",
			defaultValue: "/",
			required: true,
			placeholder: t("theme.blocks.actionButton.httpsOrPickAPage"),
		},
		{
			name: "align",
			label: t("theme.blocks.actionButton.alignment"),
			type: "select",
			defaultValue: "left",
			options: [
				{ label: t("theme.blocks.actionButton.left"), value: "left" },
				{ label: t("theme.blocks.actionButton.center"), value: "center" },
				{ label: t("theme.blocks.actionButton.right"), value: "right" },
			],
		},
	],
	defaultData: {
		text: t("theme.blocks.actionButton.learnMore"),
		href: "/",
		align: "left",
	},
};

export default component$<ActionButtonBlockProps>((props) => {
	const text = props.text ?? t("theme.blocks.actionButton.learnMore");
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
