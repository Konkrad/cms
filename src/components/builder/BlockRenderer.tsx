import { component$ } from "@qwik.dev/core";
import { Resource, useResource$ } from "@qwik.dev/core";
import type { BlockData } from "~/db/schema";

interface BlockRendererProps {
  block: BlockData;
}

export const BlockRenderer = component$<BlockRendererProps>((props) => {
  const blockRegistryResource = useResource$(async () => {
    const mod = await import("~theme/blocks");
    return mod.blockRegistry;
  });

  return (
    <Resource
      value={blockRegistryResource}
      onResolved={(registry) => {
        const BlockComponent = registry?.[props.block.componentType];
        if (!BlockComponent) {
          return (
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
              Failed to load component: {props.block.componentType}
            </div>
          );
        }
        return <BlockComponent {...props.block.data} />;
      }}
    />
  );
});
