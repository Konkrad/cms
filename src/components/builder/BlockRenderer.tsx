import { component$ } from "@qwik.dev/core";
import type { BlockData } from "~/db/schema";
import { useThemeNamedExports$ } from "~/utils/theme-loader";

interface BlockRendererProps {
  block: BlockData;
}

export const BlockRenderer = component$<BlockRendererProps>((props) => {
  const { blockRegistry } = useThemeNamedExports$(
    () => import("~theme/blocks"),
  );

  const BlockComponent = blockRegistry.value?.[props.block.componentType];

  if (!BlockComponent) {
    return (
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
        Failed to load component: {props.block.componentType}
      </div>
    );
  }

  return <BlockComponent {...props.block.data} />;
});
