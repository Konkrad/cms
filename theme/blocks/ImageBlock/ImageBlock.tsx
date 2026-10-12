import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { publicImageUrlFromKey } from "~/core/media/images";

interface ImageBlockProps {
	src?: string;
	alt?: string;
	caption?: string;
}

export const definition: BlockDefinition = {
	name: t("theme.blocks.image.image"),
	componentType: "ImageBlock",
	category: "content",
	icon: "🖼️",
	configSchema: [
		{
			name: "src",
			label: t("theme.blocks.image.image"),
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
			label: t("theme.blocks.image.altText"),
			type: "text",
			defaultValue: t("theme.blocks.image.imageDescription"),
			required: true,
		},
		{
			name: "caption",
			label: t("theme.blocks.image.caption"),
			type: "text",
			placeholder: t("theme.blocks.image.optionalCaption"),
		},
	],
	defaultData: {
		src: "public/events/seed-1.webp",
		alt: t("theme.blocks.image.imageDescription"),
		caption: "",
	},
};

export default component$<ImageBlockProps>((props) => {
	const { src, alt, caption } = props;

	return (
		<div class="max-w-4xl mx-auto px-4 py-8">
			<figure>
				<img
					src={
						publicImageUrlFromKey(src) ??
						src ??
						publicImageUrlFromKey("public/events/seed-1.webp") ??
						""
					}
					alt={alt || t("theme.imageBlock.image")}
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
