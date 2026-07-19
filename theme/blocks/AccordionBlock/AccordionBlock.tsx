import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";

interface AccordionItem {
	question: string;
	answer: string;
}

interface AccordionBlockProps {
	heading?: string;
	items?: string; // JSON string of AccordionItem[]
}

export const definition: BlockDefinition = {
	name: "Accordion",
	componentType: "AccordionBlock",
	category: "content",
	icon: "📋",
	configSchema: [
		{
			name: "heading",
			label: "Section Heading",
			type: "text",
			required: false,
		},
		{
			name: "items",
			label: "Items",
			type: "tiles",
			defaultValue: JSON.stringify([
				{ question: "Question one?", answer: "Answer one." },
				{ question: "Question two?", answer: "Answer two." },
			]),
		},
	],
	defaultData: {
		heading: "",
		items: JSON.stringify([
			{ question: "Question one?", answer: "Answer one." },
			{ question: "Question two?", answer: "Answer two." },
		]),
	},
};

export default component$<AccordionBlockProps>((props) => {
	let items: AccordionItem[] = [];
	try {
		items = JSON.parse(props.items ?? "[]");
	} catch {
		items = [];
	}

	if (items.length === 0) return <div />;

	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			{props.heading && (
				<h2 class="text-2xl font-bold text-text-heading mb-6">
					{props.heading}
				</h2>
			)}
			<div class="divide-y divide-border border border-border">
				{items.map((item, i) => (
					<details key={i} class="group">
						<summary class="flex items-center justify-between gap-4 px-4 py-4 cursor-pointer list-none font-medium text-text-heading hover:bg-bg-muted transition-colors">
							<span>{item.question}</span>
							<span class="shrink-0 text-text-muted group-open:rotate-180 transition-transform duration-200">
								▾
							</span>
						</summary>
						<div class="px-4 pb-4 pt-1 text-text-secondary text-sm leading-relaxed">
							{item.answer}
						</div>
					</details>
				))}
			</div>
		</div>
	);
});
