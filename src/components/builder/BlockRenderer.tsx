import { component$, type Signal, useSignal, useTask$ } from "@builder.io/qwik";
import type { BlockData } from "~/db/schema";
import { componentLoaderService } from "~/services/component-loader.service";

interface BlockRendererProps {
  block: BlockData;
}

export const BlockRenderer = component$<BlockRendererProps>((props) => {
  console.log("[BlockRenderer] render start:", {
    id: props.block?.id,
    componentType: props.block?.componentType,
  });
  const BlockComponent: Signal<any> = useSignal(null);
  const error = useSignal<string | null>(null);

  useTask$(async ({ track }) => {
    track(() => props.block.componentType);
    console.log("[BlockRenderer] useTask$ - begin loading block:", {
      id: props.block?.id,
      componentType: props.block?.componentType,
    });
    try {
      const Component = await componentLoaderService.loadComponent(
        props.block.componentType,
      );
      BlockComponent.value = Component;
      error.value = null;
    } catch (err: any) {
      console.error(
        `Failed to load component ${props.block.componentType}:`,
        err,
      );
      error.value = `Failed to load component: ${props.block.componentType}`;
    }
  });

  if (error.value) {
    return (
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
        {error.value}
      </div>
    );
  }

  if (!BlockComponent.value) {
    return (
      <div class="bg-gray-100 rounded-lg p-4 text-gray-500 text-sm text-center">
        Loading...
      </div>
    );
  }

  return <BlockComponent.value {...props.block.data} />;
});
