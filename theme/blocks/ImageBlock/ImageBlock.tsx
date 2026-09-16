import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { publicImageUrlFromKey } from "~/utils/images";

interface ImageBlockProps {
	src?: string;
	alt?: string;
	caption?: string;
	s3BaseUrl: string;
}

export const definition: BlockDefinition = {
	name: "Image",
	componentType: "ImageBlock",
	category: "content",
	icon: "🖼️",
	configSchema: [
		{
			name: "src",
			label: "Image",
			type: "image-upload",
			defaultValue: "public/events/seed-1.webp",
			required: true,
			uploadPath: "public/page-blocks/images",
			pipeline: "standard",
			aspectRatio: "1/1",
			crop: true,
			cropAspectRatio: "1/1",
		},
		{
			name: "alt",
			label: "Alt Text",
			type: "text",
			defaultValue: "Image description",
			required: true,
		},
		{
			name: "caption",
			label: "Caption",
			type: "text",
			placeholder: "Optional caption",
		},
	],
	defaultData: {
		src: "public/events/seed-1.webp",
		alt: "Image description",
		caption: "",
	},
};

export default component$<ImageBlockProps>((props) => {
	const { src, alt, caption, s3BaseUrl } = props;

	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			<figure>
				<img
					src={
						publicImageUrlFromKey(src, s3BaseUrl) ??
						src ??
						publicImageUrlFromKey("public/events/seed-1.webp", s3BaseUrl) ??
						""
					}
					alt={alt || "Image"}
					class="w-full rounded-lg shadow-lg"
					width={1024}
					height={1024}
				/>
				{caption && (
					<figcaption class="mt-3 text-center text-text-secondary text-sm">
						{caption}
					</figcaption>
				)}
			</figure>
		</div>
	);
});
