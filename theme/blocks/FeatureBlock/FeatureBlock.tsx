import { component$ } from "@qwik.dev/core";
import type { BlockDefinition } from "~/contracts/blocks";
import { t } from "~/contracts/i18n";
import { FeatureGrid } from "./FeatureGrid";
import { ImageTile } from "./ImageTile";
import { StatTile } from "./StatTile";

export const GRID_AREAS = [
	{
		name: "left-top",
		label: t("theme.blocks.feature.leftTop"),
		color: "#3B82F6",
	},
	{
		name: "left-bottom",
		label: t("theme.blocks.feature.leftBottom"),
		color: "#10B981",
	},
	{ name: "middle", label: t("theme.blocks.feature.middle"), color: "#F59E0B" },
	{
		name: "right-top",
		label: t("theme.blocks.feature.rightTop"),
		color: "#8B5CF6",
	},
	{
		name: "right-bottom",
		label: t("theme.blocks.feature.rightBottom"),
		color: "#EF4444",
	},
] as const;

export type GridAreaName = (typeof GRID_AREAS)[number]["name"];

export interface TileConfig {
	type: "stat" | "image";
	area: GridAreaName;
	// StatTile props
	number?: string;
	title?: string;
	description?: string;
	// ImageTile props
	image?: string;
	alt?: string;
	overlayText?: string;
}

interface FeatureBlockProps {
	layout?: string;
	gap?: number;
	tilesJson?: string;
}

const DEFAULT_LAYOUT = `"left-top middle right-top" "left-bottom middle right-top" "left-bottom middle right-bottom"`;

const DEFAULT_TILES: TileConfig[] = [
	{
		type: "stat",
		area: "left-top",
		number: "2000+",
		title: t("theme.blocks.feature.users"),
		description: t("theme.blocks.feature.aFastGrowingCommunityThat"),
	},
	{
		type: "image",
		area: "left-bottom",
		image: "public/events/seed-2.webp",
	},
	{
		type: "image",
		area: "middle",
		image: "public/events/seed-3.webp",
		overlayText: t("theme.blocks.feature.withMultipleEventsAllOver"),
	},
	{
		type: "image",
		area: "right-top",
		image: "public/events/seed-4.webp",
	},
	{
		type: "stat",
		area: "right-bottom",
		number: "10+",
		title: t("theme.blocks.feature.localCommunities"),
		description: t("theme.blocks.feature.canTFindYourCity"),
	},
];

function parseTiles(tilesJson?: string): TileConfig[] {
	if (!tilesJson) return DEFAULT_TILES;
	try {
		const parsed = JSON.parse(tilesJson);
		if (Array.isArray(parsed) && parsed.length > 0) return parsed;
		return DEFAULT_TILES;
	} catch {
		return DEFAULT_TILES;
	}
}

export const definition: BlockDefinition = {
	name: t("theme.blocks.feature.featureGrid"),
	componentType: "FeatureBlock",
	category: "content",
	icon: "🧩",
	configSchema: [
		{
			name: "layout",
			label: t("theme.blocks.feature.gridLayout"),
			type: "grid-layout",
			defaultValue: DEFAULT_LAYOUT,
		},
		{
			name: "gap",
			label: t("theme.blocks.feature.gridGapPx"),
			type: "number",
			defaultValue: 24,
		},
		{
			name: "tilesJson",
			label: t("theme.blocks.feature.tiles"),
			type: "tiles",
			defaultValue: JSON.stringify(DEFAULT_TILES, null, 2),
		},
	],
	defaultData: {
		layout: DEFAULT_LAYOUT,
		gap: 24,
		tilesJson: JSON.stringify(DEFAULT_TILES, null, 2),
	},
};

export default component$<FeatureBlockProps>((props) => {
	const layout = props.layout || DEFAULT_LAYOUT;
	const gap = props.gap ?? 24;
	const tiles = parseTiles(props.tilesJson);

	return (
		<div class="max-w-[1290px] mx-auto px-4 py-8">
			<FeatureGrid layout={layout} gap={gap}>
				{tiles.map((tile, index) => {
					if (tile.type === "stat") {
						return (
							<StatTile
								key={`tile-${index}`}
								area={tile.area}
								number={tile.number ?? "0"}
								title={tile.title ?? t("theme.featureBlock.title")}
								description={tile.description}
							/>
						);
					}

					if (tile.type === "image") {
						return (
							<ImageTile
								key={`tile-${index}`}
								area={tile.area}
								image={tile.image ?? "public/events/seed-1.webp"}
								alt={tile.alt}
								overlayText={tile.overlayText}
							/>
						);
					}

					return null;
				})}
			</FeatureGrid>
		</div>
	);
});
