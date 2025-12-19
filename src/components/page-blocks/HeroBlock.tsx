import { component$ } from "@builder.io/qwik";
import type { BlockDefinition } from "~/db/schema";

interface HeroBlockProps {
	title?: string;
	subtitle?: string;
	backgroundImage?: string;
	buttonText?: string;
	buttonUrl?: string;
}

export const definition: BlockDefinition = {
	name: "Hero Section",
	componentType: "HeroBlock",
	category: "content",
	icon: "🎯",
	configSchema: [
		{
			name: "title",
			label: "Title",
			type: "text",
			defaultValue: "Welcome",
			required: true,
		},
		{
			name: "subtitle",
			label: "Subtitle",
			type: "textarea",
			defaultValue: "This is a hero section",
		},
		{
			name: "backgroundImage",
			label: "Background Image URL",
			type: "url",
			placeholder: "https://example.com/image.jpg",
		},
		{
			name: "buttonText",
			label: "Button Text",
			type: "text",
			placeholder: "Learn More",
		},
		{
			name: "buttonUrl",
			label: "Button URL",
			type: "url",
			placeholder: "/about",
		},
	],
	defaultData: {
		title: "Welcome",
		subtitle: "This is a hero section",
		backgroundImage: "",
		buttonText: "",
		buttonUrl: "",
	},
};

export default component$<HeroBlockProps>((props) => {
	const { title, subtitle, backgroundImage, buttonText, buttonUrl } = props;

	return (
		<div
			class="relative py-20 px-4 text-center bg-cover bg-center"
			style={{
				backgroundImage: backgroundImage
					? `url(${backgroundImage})`
					: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
			}}
		>
			<div class="absolute inset-0 bg-black bg-opacity-40"></div>
			<div class="relative z-10 max-w-4xl mx-auto">
				<h1 class="text-5xl font-bold text-white mb-6">{title || "Welcome"}</h1>
				{subtitle && (
					<p class="text-xl text-white mb-8 opacity-90">{subtitle}</p>
				)}
				{buttonText && buttonUrl && (
					<a
						href={buttonUrl}
						class="inline-block px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
					>
						{buttonText}
					</a>
				)}
			</div>
		</div>
	);
});
