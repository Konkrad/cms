import { component$ } from "@builder.io/qwik";
import type { BlockDefinition } from "~/db/schema";
import { FeatureGrid } from "./FeatureGrid";
import { StatTile } from "./StatTile";
import { ImageTile } from "./ImageTile";

export const GRID_AREAS = [
  { name: "left-top", label: "Left Top", color: "#3B82F6" },
  { name: "left-bottom", label: "Left Bottom", color: "#10B981" },
  { name: "middle", label: "Middle", color: "#F59E0B" },
  { name: "right-top", label: "Right Top", color: "#8B5CF6" },
  { name: "right-bottom", label: "Right Bottom", color: "#EF4444" },
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
    title: "Members",
    description: "A fast growing community that inspires and connects.",
  },
  {
    type: "image",
    area: "left-bottom",
    image: "https://picsum.photos/400/400",
  },
  {
    type: "image",
    area: "middle",
    image: "https://picsum.photos/500/700",
    overlayText:
      "With multiple events all over Europe every year we help to grow your network and make memories.",
  },
  {
    type: "image",
    area: "right-top",
    image: "https://picsum.photos/400/500",
  },
  {
    type: "stat",
    area: "right-bottom",
    number: "10+",
    title: "Local communities",
    description: "Can't find your city yet? Start your own one.",
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
  name: "Feature Grid",
  componentType: "FeatureBlock",
  category: "content",
  icon: "🧩",
  configSchema: [
    {
      name: "layout",
      label: "Grid Layout",
      type: "grid-layout",
      defaultValue: DEFAULT_LAYOUT,
    },
    {
      name: "gap",
      label: "Grid Gap (px)",
      type: "number",
      defaultValue: 24,
    },
    {
      name: "tilesJson",
      label: "Tiles",
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
                title={tile.title ?? "Title"}
                description={tile.description}
              />
            );
          }

          if (tile.type === "image") {
            return (
              <ImageTile
                key={`tile-${index}`}
                area={tile.area}
                image={tile.image ?? "https://picsum.photos/400/400"}
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
