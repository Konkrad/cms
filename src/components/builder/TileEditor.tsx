import { $, component$, useSignal, useTask$, type QRL } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import {
  GRID_AREAS,
  type TileConfig,
} from "~/components/page-blocks/FeatureBlock/FeatureBlock";
import { publicImageUrlFromKey } from "~/utils/images";

interface TileEditorProps {
  value: string;
  onChange$: QRL<(value: string) => void>;
  triggerSignal?: import("@qwik.dev/core").Signal<boolean>;
  onSettled$?: QRL<() => void>;
}

const TILE_TYPE_OPTIONS = [
  { label: "Stat Tile", value: "stat" },
  { label: "Image Tile", value: "image" },
];

function parseTiles(value: string): TileConfig[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function createDefaultStatTile(): TileConfig {
  return {
    type: "stat",
    area: "left-top",
    number: "0",
    title: "Title",
    description: "",
  };
}

function createDefaultImageTile(): TileConfig {
  return {
    type: "image",
    area: "left-top",
    image: "public/events/seed-1.webp",
    alt: "",
    overlayText: "",
  };
}

export const TileEditor = component$<TileEditorProps>((props) => {
  const tiles = useSignal<TileConfig[]>(parseTiles(props.value));
  const expandedIndex = useSignal<number | null>(null);
  const lastSerializedValue = useSignal(props.value);
  const settledImageUploaders = useSignal(0);

  useTask$(({ track }) => {
    const shouldTrigger = track(() => props.triggerSignal?.value);
    if (shouldTrigger) {
      settledImageUploaders.value = 0;
      const imageTileCount = tiles.value.filter((tile) => tile.type === "image").length;
      if (imageTileCount === 0) {
        void props.onSettled$?.();
      }
    }
  });

  useTask$(({ track }) => {
    const val = track(() => props.value);
    if (val === lastSerializedValue.value) return;

    tiles.value = parseTiles(val);
    expandedIndex.value = null;
    lastSerializedValue.value = val;
  });

  const syncTiles = $((updated: TileConfig[]) => {
    tiles.value = [...updated];
    const serialized = JSON.stringify(updated, null, 2);
    lastSerializedValue.value = serialized;
    props.onChange$(serialized);
  });

  const handleAddTile = $((type: "stat" | "image") => {
    const newTile =
      type === "stat" ? createDefaultStatTile() : createDefaultImageTile();
    const updated = [...tiles.value, newTile];
    expandedIndex.value = updated.length - 1;
    syncTiles(updated);
  });

  const handleDeleteTile = $((index: number) => {
    const updated = tiles.value.filter((_, i) => i !== index);
    if (expandedIndex.value === index) {
      expandedIndex.value = null;
    } else if (expandedIndex.value !== null && expandedIndex.value > index) {
      expandedIndex.value = expandedIndex.value - 1;
    }
    syncTiles(updated);
  });

  const handleMoveTile = $((index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tiles.value.length) return;
    const updated = [...tiles.value];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    if (expandedIndex.value === index) {
      expandedIndex.value = newIndex;
    } else if (expandedIndex.value === newIndex) {
      expandedIndex.value = index;
    }
    syncTiles(updated);
  });

  const handleUpdateTile = $((index: number, key: string, value: string) => {
    const updated = [...tiles.value];
    updated[index] = { ...updated[index], [key]: value };
    syncTiles(updated);
  });

  const handleToggleExpand = $((index: number) => {
    expandedIndex.value = expandedIndex.value === index ? null : index;
  });

  return (
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-700">Tiles</label>

      {/* Tile list */}
      {tiles.value.length === 0 && (
        <div class="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-300 rounded-lg">
          No tiles yet. Add one below.
        </div>
      )}

      {tiles.value.map((tile, index) => {
        const isExpanded = expandedIndex.value === index;
        const typeLabel = tile.type === "stat" ? "📊 Stat" : "🖼️ Image";
        const areaInfo = GRID_AREAS.find((a) => a.name === tile.area);
        const areaColor = areaInfo?.color ?? "#9CA3AF";

        return (
          <div
            key={`tile-${index}-${tile.area}`}
            class="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden"
          >
            {/* Tile header - always visible */}
            <div class="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                class="flex-1 flex items-center gap-2 text-left text-sm font-medium text-gray-800 hover:text-gray-900"
                onClick$={() => handleToggleExpand(index)}
              >
                <span
                  class="text-xs text-gray-400 transition-transform"
                  style={{
                    display: "inline-block",
                    transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                >
                  ▶
                </span>
                <span>{typeLabel}</span>
                <span
                  class="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm"
                  style={{
                    backgroundColor: areaColor + "20",
                    color: areaColor,
                  }}
                >
                  {areaInfo?.label ?? tile.area}
                </span>
              </button>

              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  disabled={index === 0}
                  onClick$={() => handleMoveTile(index, "up")}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  disabled={index === tiles.value.length - 1}
                  onClick$={() => handleMoveTile(index, "down")}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="p-1 text-red-400 hover:text-red-600"
                  onClick$={() => handleDeleteTile(index)}
                  title="Delete tile"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tile fields - shown when expanded */}
            {isExpanded && (
              <div class="border-t border-gray-200 px-3 py-3 space-y-3 bg-white">
                {/* Type selector */}
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    Type
                  </label>
                  <select
                    class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={tile.type}
                    onChange$={(e) => {
                      const newType = (e.target as HTMLSelectElement).value as
                        | "stat"
                        | "image";
                      if (newType === tile.type) return;
                      const area = tile.area;
                      const newTile =
                        newType === "stat"
                          ? createDefaultStatTile()
                          : createDefaultImageTile();
                      newTile.area = area;
                      const updated = [...tiles.value];
                      updated[index] = newTile;
                      syncTiles(updated);
                    }}
                  >
                    {TILE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grid Area dropdown */}
                <div>
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    Grid Area
                  </label>
                  <select
                    class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={tile.area}
                    onChange$={(e) =>
                      handleUpdateTile(
                        index,
                        "area",
                        (e.target as HTMLSelectElement).value,
                      )
                    }
                  >
                    {GRID_AREAS.map((area) => (
                      <option key={area.name} value={area.name}>
                        {area.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stat-specific fields */}
                {tile.type === "stat" && (
                  <>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Number
                      </label>
                      <input
                        type="text"
                        class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={tile.number ?? ""}
                        placeholder="e.g. 2000+"
                        onInput$={(e) =>
                          handleUpdateTile(
                            index,
                            "number",
                            (e.target as HTMLInputElement).value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Title
                      </label>
                      <input
                        type="text"
                        class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={tile.title ?? ""}
                        placeholder="e.g. Members"
                        onInput$={(e) =>
                          handleUpdateTile(
                            index,
                            "title",
                            (e.target as HTMLInputElement).value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Description
                      </label>
                      <textarea
                        class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                        value={tile.description ?? ""}
                        placeholder="Optional description"
                        onInput$={(e) =>
                          handleUpdateTile(
                            index,
                            "description",
                            (e.target as HTMLTextAreaElement).value,
                          )
                        }
                      />
                    </div>
                  </>
                )}

                {/* Image-specific fields */}
                {tile.type === "image" && (
                  <>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Image Upload
                      </label>
                      <ImageUploader
                        path="public/page-blocks/feature-grid"
                        pipeline="standard"
                        triggerSignal={props.triggerSignal}
                        onSettled$={$(() => {
                          settledImageUploaders.value += 1;
                          const imageTileCount = tiles.value.filter((candidate) => candidate.type === "image").length;
                          if (settledImageUploaders.value >= imageTileCount) {
                            void props.onSettled$?.();
                          }
                        })}
                        crop
                        cropAspectRatio="3/4"
                        aspectRatio="3/4"
                        currentUrl={
                          tile.image && !tile.image.startsWith("blob:")
                            ? publicImageUrlFromKey(tile.image) ?? undefined
                            : tile.image
                        }
                        currentValue={tile.image}
                        onFileSelected$={(blobUrl: string) => {
                          handleUpdateTile(index, "image", blobUrl);
                        }}
                        onFileUploaded$={(response) => {
                          // After upload succeeds, update tile with the actual key
                          if (response.filePath) {
                            handleUpdateTile(index, "image", response.filePath);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Alt Text
                      </label>
                      <input
                        type="text"
                        class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        value={tile.alt ?? ""}
                        placeholder="Describe the image"
                        onInput$={(e) =>
                          handleUpdateTile(
                            index,
                            "alt",
                            (e.target as HTMLInputElement).value,
                          )
                        }
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 mb-1">
                        Overlay Text
                      </label>
                      <textarea
                        class="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        rows={2}
                        value={tile.overlayText ?? ""}
                        placeholder="Optional text over image"
                        onInput$={(e) =>
                          handleUpdateTile(
                            index,
                            "overlayText",
                            (e.target as HTMLTextAreaElement).value,
                          )
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add tile buttons */}
      <div class="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="flex-1 flex items-center justify-center gap-1.5"
          onClick$={() => handleAddTile("stat")}
        >
          <span>📊</span>
          <span>Add Stat</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          class="flex-1 flex items-center justify-center gap-1.5"
          onClick$={() => handleAddTile("image")}
        >
          <span>🖼️</span>
          <span>Add Image</span>
        </Button>
      </div>
    </div>
  );
});
