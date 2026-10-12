import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";

type CalloutType = "info" | "tip" | "warning" | "danger";

interface CalloutBlockProps {
	type?: CalloutType;
	title?: string;
	body?: string;
}

const STYLES: Record<
	CalloutType,
	{ border: string; bg: string; icon: string; text: string }
> = {
	info: {
		border: "border-info",
		bg: "bg-info-bg",
		icon: "ℹ️",
		text: "text-info",
	},
	tip: {
		border: "border-success",
		bg: "bg-success-bg",
		icon: "💡",
		text: "text-success",
	},
	warning: {
		border: "border-warning",
		bg: "bg-warning-bg",
		icon: "⚠️",
		text: "text-warning",
	},
	danger: {
		border: "border-error",
		bg: "bg-error-bg",
		icon: "🚨",
		text: "text-error",
	},
};

export const definition: BlockDefinition = {
	name: t("theme.blocks.callout.callout"),
	componentType: "CalloutBlock",
	category: "content",
	icon: "📣",
	configSchema: [
		{
			name: "type",
			label: t("theme.blocks.callout.type"),
			type: "select",
			options: [
				{ label: t("theme.blocks.callout.info"), value: "info" },
				{ label: t("theme.blocks.callout.tip"), value: "tip" },
				{ label: t("theme.blocks.callout.warning"), value: "warning" },
				{ label: t("theme.blocks.callout.danger"), value: "danger" },
			],
			defaultValue: "info",
		},
		{
			name: "title",
			label: t("theme.blocks.callout.title"),
			type: "text",
			required: false,
		},
		{
			name: "body",
			label: t("theme.blocks.callout.body"),
			type: "textarea",
			defaultValue: t("theme.blocks.callout.addYourCalloutMessageHere"),
		},
	],
	defaultData: {
		type: "info",
		title: "",
		body: t("theme.blocks.callout.addYourCalloutMessageHere"),
	},
};

export default component$<CalloutBlockProps>((props) => {
	const type: CalloutType = (props.type as CalloutType) ?? "info";
	const s = STYLES[type];

	return (
		<div class={`max-w-4xl mx-auto px-4 py-4`}>
			<div class={`border-l-4 ${s.border} ${s.bg} p-4 flex gap-3`}>
				<span class="text-xl shrink-0 mt-0.5" aria-hidden="true">
					{s.icon}
				</span>
				<div>
					{props.title && (
						<p class={`font-semibold mb-1 ${s.text}`}>{props.title}</p>
					)}
					{props.body && (
						<p class="text-sm text-text-secondary leading-relaxed">
							{props.body}
						</p>
					)}
				</div>
			</div>
		</div>
	);
});
