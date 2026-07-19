import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";

interface VideoBlockProps {
	url?: string;
	caption?: string;
}

function toEmbedUrl(url: string): string | null {
	if (!url) return null;

	// YouTube: watch?v=ID or youtu.be/ID or youtube.com/embed/ID
	const ytMatch = url.match(
		/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
	);
	if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;

	// Vimeo: vimeo.com/ID
	const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
	if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

	// Direct video file — handled separately
	return null;
}

function isDirectVideo(url: string): boolean {
	return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
}

export const definition: BlockDefinition = {
	name: "Video",
	componentType: "VideoBlock",
	category: "content",
	icon: "🎬",
	configSchema: [
		{
			name: "url",
			label: "Video URL (YouTube, Vimeo, or .mp4)",
			type: "url",
			defaultValue: "",
		},
		{ name: "caption", label: "Caption", type: "text", required: false },
	],
	defaultData: { url: "", caption: "" },
};

export default component$<VideoBlockProps>((props) => {
	const url = props.url ?? "";
	const embedUrl = toEmbedUrl(url);
	const direct = !embedUrl && isDirectVideo(url);

	if (!url) return <div />;

	return (
		<div class="max-w-4xl mx-auto px-4 py-6">
			<figure>
				<div class="relative w-full" style={{ paddingBottom: "56.25%" }}>
					{embedUrl ? (
						<iframe
							src={embedUrl}
							title={props.caption ?? "Video"}
							class="absolute inset-0 w-full h-full border-0"
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowFullscreen
						/>
					) : direct ? (
						// biome-ignore lint/a11y/useMediaCaption: arbitrary admin-supplied video URL, no caption track is available
						<video
							src={url}
							controls
							class="absolute inset-0 w-full h-full object-contain bg-black"
						/>
					) : (
						<div class="absolute inset-0 flex items-center justify-center bg-bg-muted border border-border">
							<p class="text-text-muted text-sm">Unsupported video URL</p>
						</div>
					)}
				</div>
				{props.caption && (
					<figcaption class="mt-2 text-center text-sm text-text-muted">
						{props.caption}
					</figcaption>
				)}
			</figure>
		</div>
	);
});
