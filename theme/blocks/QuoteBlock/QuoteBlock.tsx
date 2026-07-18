import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";

interface QuoteBlockProps {
	quote?: string;
	attribution?: string;
	role?: string;
}

export const definition: BlockDefinition = {
	name: "Quote",
	componentType: "QuoteBlock",
	category: "content",
	icon: "💬",
	configSchema: [
		{
			name: "quote",
			label: "Quote",
			type: "textarea",
			defaultValue: "Your quote goes here.",
		},
		{ name: "attribution", label: "Name", type: "text", required: false },
		{
			name: "role",
			label: "Role / Organisation",
			type: "text",
			required: false,
		},
	],
	defaultData: { quote: "Your quote goes here.", attribution: "", role: "" },
};

export default component$<QuoteBlockProps>((props) => {
	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			<blockquote class="border-l-4 border-primary pl-6">
				<p class="text-xl sm:text-2xl font-medium text-text-heading leading-relaxed">
					"{props.quote}"
				</p>
				{(props.attribution || props.role) && (
					<footer class="mt-4 flex flex-col gap-0.5">
						{props.attribution && (
							<cite class="not-italic font-semibold text-text-heading text-base">
								{props.attribution}
							</cite>
						)}
						{props.role && (
							<span class="text-sm text-text-muted">{props.role}</span>
						)}
					</footer>
				)}
			</blockquote>
		</div>
	);
});
