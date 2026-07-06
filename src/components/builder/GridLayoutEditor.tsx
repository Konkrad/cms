import { $, component$, useSignal, useTask$, type QRL } from "@qwik.dev/core";
import { useThemeNamedExports$ } from "~/utils/theme-loader";

interface GridLayoutEditorProps {
  value: string;
  onChange$: QRL<(value: string) => void>;
}

interface GridAreaInfo {
  name: string;
  label: string;
  color: string;
}

type GridCell = string;

const ROWS = 3;
const COLS = 3;

function parseLayout(value: string): GridCell[][] {
  const grid: GridCell[][] = [];
  // Parse CSS grid-template-areas string like:
  // "left-top middle right-top" "left-bottom middle right-top" "left-bottom middle right-bottom"
  const rowMatches = value.match(/"([^"]+)"/g);
  if (rowMatches && rowMatches.length === ROWS) {
    for (const rowMatch of rowMatches) {
      const cells = rowMatch.replace(/"/g, "").trim().split(/\s+/);
      if (cells.length === COLS) {
        grid.push(cells);
      }
    }
  }

  // Fallback to default if parsing failed
  if (grid.length !== ROWS) {
    return [
      ["left-top", "middle", "right-top"],
      ["left-bottom", "middle", "right-top"],
      ["left-bottom", "middle", "right-bottom"],
    ];
  }

  return grid;
}

function gridToLayout(grid: GridCell[][]): string {
  return grid.map((row) => `"${row.join(" ")}"`).join(" ");
}

function getAreaColor(areaName: string, gridAreas: GridAreaInfo[]): string {
  const area = gridAreas.find((a) => a.name === areaName);
  return area?.color ?? "#9CA3AF";
}

function getAreaLabel(areaName: string, gridAreas: GridAreaInfo[]): string {
  const area = gridAreas.find((a) => a.name === areaName);
  return area?.label ?? areaName;
}

export const GridLayoutEditor = component$<GridLayoutEditorProps>((props) => {
  // Load theme constants dynamically
  const { GRID_AREAS: gridAreasResource } = useThemeNamedExports$<{
    GRID_AREAS: GridAreaInfo[];
  }>(() => import("~theme/blocks/FeatureBlock/FeatureBlock"));

  const grid = useSignal<GridCell[][]>(parseLayout(props.value));
  const selectedArea = useSignal<string>(
    gridAreasResource.value?.[0]?.name ?? "left-top",
  );

  useTask$(({ track }) => {
    track(() => props.value);
    grid.value = parseLayout(props.value);
  });

  const handleCellClick = $((row: number, col: number) => {
    const updated = grid.value.map((r) => [...r]);
    updated[row][col] = selectedArea.value;
    grid.value = updated;
    props.onChange$(gridToLayout(updated));
  });

  return (
    <div class="space-y-3">
      <label class="block text-sm font-medium text-gray-700">Grid Layout</label>

      {/* Area palette - pick which area to paint */}
      <div class="space-y-1.5">
        <span class="text-xs text-gray-500">
          Select an area, then click cells to assign:
        </span>
        <div class="flex flex-wrap gap-1.5">
          {gridAreasResource.value?.map((area) => {
            const isSelected = selectedArea.value === area.name;
            return (
              <button
                key={area.name}
                type="button"
                class={`px-2 py-1 text-xs font-medium rounded-md border-2 transition-all ${
                  isSelected
                    ? "ring-2 ring-offset-1 ring-gray-900 scale-105"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: area.color + "20",
                  borderColor: area.color,
                  color: area.color,
                }}
                onClick$={() => {
                  selectedArea.value = area.name;
                }}
              >
                {area.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3×3 visual grid */}
      <div
        class="grid gap-1.5 rounded-lg border border-gray-200 bg-gray-100 p-2"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {grid.value.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const color = getAreaColor(cell, gridAreasResource.value ?? []);
            const label = getAreaLabel(cell, gridAreasResource.value ?? []);

            // Check if this cell is part of a larger block of same area
            // to show merged visual appearance
            const sameRight = colIdx < COLS - 1 && row[colIdx + 1] === cell;
            const sameBottom =
              rowIdx < ROWS - 1 && grid.value[rowIdx + 1][colIdx] === cell;
            const sameLeft = colIdx > 0 && row[colIdx - 1] === cell;
            const sameTop =
              rowIdx > 0 && grid.value[rowIdx - 1][colIdx] === cell;

            return (
              <button
                key={`${rowIdx}-${colIdx}`}
                type="button"
                class="h-14 flex items-center justify-center text-[10px] font-semibold leading-tight text-center transition-all hover:brightness-90 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: color + "30",
                  borderTop: `2px solid ${sameTop ? "transparent" : color}`,
                  borderBottom: `2px solid ${sameBottom ? "transparent" : color}`,
                  borderLeft: `2px solid ${sameLeft ? "transparent" : color}`,
                  borderRight: `2px solid ${sameRight ? "transparent" : color}`,
                  borderTopLeftRadius: !sameTop && !sameLeft ? "8px" : "0",
                  borderTopRightRadius: !sameTop && !sameRight ? "8px" : "0",
                  borderBottomLeftRadius:
                    !sameBottom && !sameLeft ? "8px" : "0",
                  borderBottomRightRadius:
                    !sameBottom && !sameRight ? "8px" : "0",
                  color: color,
                }}
                title={`Set to ${selectedArea.value}`}
                onClick$={() => handleCellClick(rowIdx, colIdx)}
              >
                {label}
              </button>
            );
          }),
        )}
      </div>

      {/* Legend showing generated layout */}
      <div class="text-[10px] text-gray-400 font-mono break-all leading-relaxed">
        {gridToLayout(grid.value)}
      </div>
    </div>
  );
});
