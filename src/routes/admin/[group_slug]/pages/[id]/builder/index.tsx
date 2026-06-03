import { $, component$, useSignal } from "@qwik.dev/core";
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

  const initDefinitionsMap: Record<string, BlockDefinition> = {};
  componentDefinitions.value.forEach((def) => {
    initDefinitionsMap[def.componentType] = def;
  });

  const blocks = useSignal<BlockData[]>(page.value.content || []);
  const selectedBlockId = useSignal<string | null>(null);
  const hasUnsavedChanges = useSignal(false);
  const definitionsMap = useSignal<Record<string, BlockDefinition>>(initDefinitionsMap);
  const uploadTrigger = useSignal(false);
  const settledUploadGroups = useSignal(0);

  const handleAddBlock = $((componentType: string) => {
    const definition = definitionsMap.value[componentType];
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

  const handleUploadGroupSettled = $(() => {
    settledUploadGroups.value += 1;
  });

  const waitForUploads = $(async (expectedGroups: number) => {
    if (expectedGroups <= 0) return;

    settledUploadGroups.value = 0;
    uploadTrigger.value = false;
    await new Promise<void>((resolve) => {
      const check = () => {
        if (settledUploadGroups.value >= expectedGroups) {
          resolve();
          return;
        }
        setTimeout(check, 25);
      };
      uploadTrigger.value = true;
      check();
    });
    uploadTrigger.value = false;
  });

  const handleSave = $(async () => {
    const selectedBlock = blocks.value.find((block) => block.id === selectedBlockId.value);
    const selectedDefinition = selectedBlock
      ? definitionsMap.value[selectedBlock.componentType]
      : undefined;
    const hasTileEditor = !!selectedDefinition?.configSchema.some(
      (field) => field.type === "tiles",
    );
    const expectedUploadGroups = 1 + (hasTileEditor ? 1 : 0);

    await waitForUploads(expectedUploadGroups);

    // Allow in-flight QRL signal-update chains (e.g. onFileUploaded$) to settle
    // before reading blocks.value. QRL calls are async and may not have resolved
    // by the time the last onSettled$ fires.
    await new Promise((r) => setTimeout(r, 50));

    const blocksToSave = JSON.parse(JSON.stringify(blocks.value));

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
            {page.value.menuItem?.title}
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
              ? definitionsMap.value[
                  blocks.value.find((b) => b.id === selectedBlockId.value)
                    ?.componentType || ""
                ]
              : undefined
          }
          onUpdateData={handleUpdateBlockData}
          triggerSignal={uploadTrigger}
          onSettled$={handleUploadGroupSettled}
        />
      </div>
    </div>
  );
});
