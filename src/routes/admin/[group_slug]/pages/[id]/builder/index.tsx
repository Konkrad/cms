import { $, component$, useSignal, useTask$ } from "@qwik.dev/core";
import { routeAction$, routeLoader$, z, zod$ } from "@qwik.dev/router";
import { Canvas } from "~/components/builder/Canvas";
import { ComponentsSidebar } from "~/components/builder/ComponentsSidebar";
import { PropertiesPanel } from "~/components/builder/PropertiesPanel";
import { Button } from "~/components/ui/Button";
import type { BlockData, BlockDefinition } from "~/db/schema";
import { componentLoaderService } from "~/services/component-loader.service";
import { pagesService } from "~/services/pages.service";
import { requireAdmin } from "~/utils/server-auth";

// Pages are only accessible in global context
export const useCheckGlobalContext = routeLoader$(
  async ({ params, redirect }) => {
    if (params.group_slug !== "global") {
      throw redirect(302, `/admin/${params.group_slug}`);
    }
    return true;
  },
);

export const useAdminAuth = routeLoader$(async (event) => {
  await requireAdmin(event);
  return true;
});

export const usePage = routeLoader$(async ({ params }) => {
  const page = await pagesService.getById(params.id);
  if (!page) {
    throw new Error("Page not found");
  }
  return page;
});

export const useComponentDefinitions = routeLoader$(async () => {
  const definitions = await componentLoaderService.getComponentDefinitions();
  return Array.from(definitions.values());
});

export const useSavePage = routeAction$(
  async (data, event) => {
    await requireAdmin(event);

    const accessToken = event.cookie.get("sb-access-token")?.value;
    const refreshToken = event.cookie.get("sb-refresh-token")?.value;

    try {
      const content = JSON.parse(data.content);
      await pagesService.update(event.params.id, { content });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to save page",
      };
    }
  },
  zod$({
    content: z.string(),
  }),
);

export default component$(() => {
  const page = usePage();
  const componentDefinitions = useComponentDefinitions();
  const saveAction = useSavePage();

  const blocks = useSignal<BlockData[]>([]);
  const selectedBlockId = useSignal<string | null>(null);
  const hasUnsavedChanges = useSignal(false);
  const definitionsMap = useSignal<Map<string, BlockDefinition>>(new Map());

  useTask$(({ track }) => {
    track(() => page.value);
    blocks.value = page.value.content || [];
  });

  useTask$(({ track }) => {
    track(() => componentDefinitions.value);
    const map = new Map<string, BlockDefinition>();
    componentDefinitions.value.forEach((def) => {
      map.set(def.componentType, def);
    });
    definitionsMap.value = map;
  });

  const handleAddBlock = $((componentType: string) => {
    const definition = definitionsMap.value.get(componentType);
    if (!definition) return;

    const newBlock: BlockData = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      componentType,
      order: blocks.value.length,
      data: { ...definition.defaultData },
    };

    blocks.value = [...blocks.value, newBlock];
    selectedBlockId.value = newBlock.id;
    hasUnsavedChanges.value = true;
  });

  const handleDeleteBlock = $((blockId: string) => {
    blocks.value = blocks.value
      .filter((b) => b.id !== blockId)
      .map((b, index) => ({ ...b, order: index }));
    if (selectedBlockId.value === blockId) {
      selectedBlockId.value = null;
    }
    hasUnsavedChanges.value = true;
  });

  const handleDuplicateBlock = $((blockId: string) => {
    const block = blocks.value.find((b) => b.id === blockId);
    if (!block) return;

    const newBlock: BlockData = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      componentType: block.componentType,
      order: block.order + 1,
      data: { ...block.data },
    };

    const newBlocks = [...blocks.value];
    newBlocks.splice(block.order + 1, 0, newBlock);
    blocks.value = newBlocks.map((b, index) => ({ ...b, order: index }));
    hasUnsavedChanges.value = true;
  });

  const handleSelectBlock = $((blockId: string | null) => {
    selectedBlockId.value = blockId;
  });

  const handleUpdateBlockData = $(
    (blockId: string, newData: Record<string, any>) => {
      blocks.value = blocks.value.map((b) =>
        b.id === blockId ? { ...b, data: newData } : b,
      );
      hasUnsavedChanges.value = true;
    },
  );

  const handleReorderBlocks = $((reorderedBlocks: BlockData[]) => {
    blocks.value = reorderedBlocks.map((b, index) => ({ ...b, order: index }));
    hasUnsavedChanges.value = true;
  });

  const handleMoveBlockUp = $((blockId: string) => {
    const index = blocks.value.findIndex((b) => b.id === blockId);
    if (index <= 0) return;

    const newBlocks = [...blocks.value];
    [newBlocks[index - 1], newBlocks[index]] = [
      newBlocks[index],
      newBlocks[index - 1],
    ];
    blocks.value = newBlocks.map((b, index) => ({ ...b, order: index }));
    hasUnsavedChanges.value = true;
  });

  const handleMoveBlockDown = $((blockId: string) => {
    const index = blocks.value.findIndex((b) => b.id === blockId);
    if (index >= blocks.value.length - 1) return;

    const newBlocks = [...blocks.value];
    [newBlocks[index], newBlocks[index + 1]] = [
      newBlocks[index + 1],
      newBlocks[index],
    ];
    blocks.value = newBlocks.map((b, index) => ({ ...b, order: index }));
    hasUnsavedChanges.value = true;
  });

  const handleSave = $(async () => {
    // Clone blocks to avoid mutating the signal while we process uploads
    let blocksToSave = JSON.parse(JSON.stringify(blocks.value));

    // Upload any pending blob URLs for configured image-upload fields.
    for (const block of blocksToSave) {
      const definition = definitionsMap.value.get(block.componentType);
      const fields = definition?.configSchema ?? [];

      for (const field of fields) {
        if (field.type !== "image-upload") continue;

        const fieldValue = block.data?.[field.name];
        if (typeof fieldValue !== "string" || !fieldValue.startsWith("blob:")) {
          continue;
        }

        try {
          const blobResponse = await fetch(fieldValue);
          const blob = await blobResponse.blob();

          const uploadResponse = await fetch("/api/images", {
            method: "POST",
            headers: {
              "x-upload-path": field.uploadPath ?? "public/page-blocks",
              "x-pipeline": field.pipeline ?? "standard",
            },
            body: blob,
          });

          if (uploadResponse.ok) {
            const uploadedData = await uploadResponse.json();
            if (uploadedData?.filePath) {
              block.data[field.name] = uploadedData.filePath;
            }
          }
        } catch (err) {
          console.error(`Failed to upload blob image for field ${field.name}:`, err);
        }
      }
    }
    
    // Scan for blob URLs in feature blocks and upload them
    for (const block of blocksToSave) {
      if (block.componentType === "FeatureBlock" && block.data.tilesJson) {
        try {
          const tiles = JSON.parse(block.data.tilesJson);
          for (const tile of tiles) {
            if (tile.image?.startsWith("blob:")) {
              // Convert blob URL to File and upload it
              const response = await fetch(tile.image);
              const blob = await response.blob();
              const formData = new FormData();
              formData.append("file", blob, "image.webp");
              
              const uploadResponse = await fetch("/api/images", {
                method: "POST",
                headers: {
                  "x-upload-path": "public/page-blocks/feature-grid",
                  "x-pipeline": "standard",
                },
                body: blob,
              });
              
              if (uploadResponse.ok) {
                const uploadedData = await uploadResponse.json();
                tile.image = uploadedData.filePath;
              }
            }
          }
          block.data.tilesJson = JSON.stringify(tiles);
        } catch (err) {
          console.error("Failed to upload blob image:", err);
        }
      }
    }
    
    const formData = new FormData();
    formData.append("content", JSON.stringify(blocksToSave));

    await saveAction.submit(formData);
    if (saveAction.value?.success) {
      blocks.value = blocksToSave;
      hasUnsavedChanges.value = false;
    }
  });

  return (
    <div class="fixed inset-0 bg-gray-50 flex flex-col">
      <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <a
            href="/admin/global/pages"
            class="text-gray-600 hover:text-gray-900"
          >
            ← Back to Pages
          </a>
          <div class="border-l border-gray-300 h-6"></div>
          <h1 class="text-lg font-semibold text-gray-900">
            {page.value.title}
          </h1>
          {hasUnsavedChanges.value && (
            <span class="text-sm text-orange-600 font-medium">
              • Unsaved changes
            </span>
          )}
        </div>
        <div class="flex items-center gap-3">
          {saveAction.value?.success && (
            <span class="text-sm text-green-600">Saved!</span>
          )}
          {saveAction.value?.error && (
            <span class="text-sm text-red-600">{saveAction.value.error}</span>
          )}
          <Button
            variant="primary"
            onClick$={handleSave}
            disabled={saveAction.isRunning || !hasUnsavedChanges.value}
          >
            {saveAction.isRunning ? "Saving..." : "Save Page"}
          </Button>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        <ComponentsSidebar
          definitions={componentDefinitions.value}
          onAddBlock={handleAddBlock}
        />

        <Canvas
          blocks={blocks.value}
          selectedBlockId={selectedBlockId.value}
          onSelectBlock={handleSelectBlock}
          onDeleteBlock={handleDeleteBlock}
          onDuplicateBlock={handleDuplicateBlock}
          onReorderBlocks={handleReorderBlocks}
          onMoveBlockUp={handleMoveBlockUp}
          onMoveBlockDown={handleMoveBlockDown}
          definitionsMap={definitionsMap.value}
        />

        <PropertiesPanel
          selectedBlock={blocks.value.find(
            (b) => b.id === selectedBlockId.value,
          )}
          definition={
            selectedBlockId.value
              ? definitionsMap.value.get(
                  blocks.value.find((b) => b.id === selectedBlockId.value)
                    ?.componentType || "",
                )
              : undefined
          }
          onUpdateData={handleUpdateBlockData}
        />
      </div>
    </div>
  );
});
