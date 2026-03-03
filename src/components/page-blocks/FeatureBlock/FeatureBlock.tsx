import { component$ } from "@builder.io/qwik";
import type { BlockDefinition } from "~/db/schema";
import { FeatureGrid } from "./FeatureGrid";
import { StatTile } from "./StatTile";
import { ImageTile } from "./ImageTile";

export interface TileConfig {
  type: "stat" | "image";
  area: string;
  // StatTile props
  number?: string;
  title?: string;
  description?: string;
  statSize?: "sm" | "md" | "lg";
  // ImageTile props
  image?: string;
  alt?: string;
  overlayText?: string;
  imageSize?: "sm" | "md" | "lg" | "xl";
}

interface FeatureBlockProps {
  layout?: string;
  gap?: number;
  tilesJson?: string;
}

const DEFAULT_LAYOUT = `
  "left-top middle right-top"
  "left-bottom middle right-top"
  "left-bottom middle right-bottom"
`;

const DEFAULT_TILES: TileConfig[] = [
  {
    type: "stat",
    area: "left-top",
    number: "2000+",
    title: "Members",
    description: "A fast growing community that inspires and connects.",
    statSize: "sm",
  },
  {
    type: "image",
    area: "left-bottom",
    image: "https://picsum.photos/400/400",
    imageSize: "md",
  },
  {
    type: "image",
    area: "middle",
    image: "https://picsum.photos/500/700",
    overlayText:
      "With multiple events all over Europe every year we help to grow your network and make memories.",
    imageSize: "xl",
  },
  {
    type: "image",
    area: "right-top",
    image: "https://picsum.photos/400/500",
    imageSize: "md",
  },
  {
    type: "stat",
    area: "right-bottom",
    number: "10+",
    title: "Local communities",
    description: "Can't find your city yet? Start your own one.",
    statSize: "sm",
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
      label: "Grid Layout (CSS grid-template-areas)",
      type: "textarea",
      defaultValue: DEFAULT_LAYOUT.trim(),
      placeholder: `"left-top middle right-top"\n"left-bottom middle right-top"\n"left-bottom middle right-bottom"`,
    },
    {
      name: "gap",
      label: "Grid Gap (px)",
      type: "number",
      defaultValue: 24,
    },
    {
      name: "tilesJson",
      label: "Tiles Configuration (JSON)",
      type: "textarea",
      defaultValue: JSON.stringify(DEFAULT_TILES, null, 2),
    },
  ],
  defaultData: {
    layout: DEFAULT_LAYOUT.trim(),
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
                size={tile.statSize}
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
                size={tile.imageSize}
              />
            );
          }

          return null;
        })}
      </FeatureGrid>
    </div>
  );
});
