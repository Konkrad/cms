import { $, component$, type QRL, useSignal, useTask$ } from "@qwik.dev/core";
import { Input } from "~/components/ui/Input";
import { Select } from "~/components/ui/Select";
import { TextArea } from "~/components/ui/TextArea";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { TileEditor } from "~/components/builder/TileEditor";
import { GridLayoutEditor } from "~/components/builder/GridLayoutEditor";
import type { BlockData, BlockDefinition } from "~/db/schema";
import { publicImageUrlFromKey } from "~/utils/images";

interface PropertiesPanelProps {
  selectedBlock?: BlockData;
  definition?: BlockDefinition;
  onUpdateData: QRL<(blockId: string, data: Record<string, any>) => void>;
  triggerSignal?: import("@qwik.dev/core").Signal<boolean>;
  onSettled$?: QRL<() => void>;
}

export const PropertiesPanel = component$<PropertiesPanelProps>((props) => {
  const localData = useSignal<Record<string, any>>({});
  const settledImageUploaders = useSignal(0);

  const imageUploadFields =
    props.definition?.configSchema.filter((field) => field.type === "image-upload") ?? [];

  useTask$(({ track }) => {
    const shouldTrigger = track(() => props.triggerSignal?.value);
    if (shouldTrigger) {
      settledImageUploaders.value = 0;
      if (imageUploadFields.length === 0) {
        void props.onSettled$?.();
      }
    }
  });

  useTask$(({ track }) => {
    track(() => props.selectedBlock);
    if (props.selectedBlock) {
      localData.value = { ...props.selectedBlock.data };
    }
  });

  const handleChange = $(async (fieldName: string, value: any) => {
    localData.value = {
      ...localData.value,
      [fieldName]: value,
    };

    if (props.selectedBlock) {
      await props.onUpdateData(props.selectedBlock.id, localData.value);
    }
  });

  if (!props.selectedBlock || !props.definition) {
    return (
      <div class="w-80 bg-white border-l border-gray-200 p-6">
        <div class="text-center text-gray-500 text-sm">
          <div class="text-4xl mb-3">⚙️</div>
          <p>Select a block to edit its properties</p>
        </div>
      </div>
    );
  }

  return (
    <div class="w-80 bg-white border-l border-gray-200 flex flex-col">
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-2xl">{props.definition.icon}</span>
          <h2 class="text-sm font-semibold text-gray-900">
            {props.definition.name}
          </h2>
        </div>
        <p class="text-xs text-gray-500">Configure block properties</p>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {props.definition.configSchema.map((field) => {
          const value = localData.value[field.name];

          if (field.type === "text" || field.type === "url") {
            return (
              <Input
                key={field.name}
                name={field.name}
                label={field.label}
                type={field.type === "url" ? "url" : "text"}
                value={value || ""}
                placeholder={field.placeholder}
                required={field.required}
                onInput$={(e) => {
                  handleChange(
                    field.name,
                    (e.target as HTMLInputElement).value,
                  );
                }}
              />
            );
          }

          if (field.type === "textarea") {
            return (
              <TextArea
                key={field.name}
                name={field.name}
                label={field.label}
                value={value || ""}
                placeholder={field.placeholder}
                required={field.required}
                rows={6}
                onInput$={(e) => {
                  handleChange(
                    field.name,
                    (e.target as HTMLTextAreaElement).value,
                  );
                }}
              />
            );
          }

          if (field.type === "number") {
            return (
              <Input
                key={field.name}
                name={field.name}
                label={field.label}
                type="number"
                value={value?.toString() || ""}
                placeholder={field.placeholder}
                required={field.required}
                onInput$={(e) => {
                  const numValue = parseFloat(
                    (e.target as HTMLInputElement).value,
                  );
                  handleChange(field.name, isNaN(numValue) ? 0 : numValue);
                }}
              />
            );
          }

          if (field.type === "boolean") {
            return (
              <div key={field.name} class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={field.name}
                  checked={value || false}
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded-sm focus:ring-blue-500"
                  onChange$={(e) => {
                    handleChange(
                      field.name,
                      (e.target as HTMLInputElement).checked,
                    );
                  }}
                />
                <label
                  for={field.name}
                  class="text-sm font-medium text-gray-700"
                >
                  {field.label}
                </label>
              </div>
            );
          }

          if (field.type === "select" && field.options) {
            return (
              <Select
                key={field.name}
                name={field.name}
                label={field.label}
                value={value || ""}
                required={field.required}
                onChange$={(e) => {
                  handleChange(
                    field.name,
                    (e.target as HTMLSelectElement).value,
                  );
                }}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            );
          }

          if (field.type === "image-upload") {
            const currentUrl =
              typeof value === "string" && value.length > 0
                ? publicImageUrlFromKey(value) ?? value
                : undefined;

            return (
              <div key={field.name}>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <ImageUploader
                  path={field.uploadPath ?? "public/page-blocks"}
                  pipeline={field.pipeline ?? "standard"}
                  triggerSignal={props.triggerSignal}
                  onSettled$={$(() => {
                    settledImageUploaders.value += 1;
                    if (settledImageUploaders.value >= imageUploadFields.length) {
                      void props.onSettled$?.();
                    }
                  })}
                  aspectRatio={field.aspectRatio ?? "1/1"}
                  crop={field.crop}
                  cropAspectRatio={field.cropAspectRatio}
                  currentUrl={currentUrl}
                  currentValue={typeof value === "string" ? value : undefined}
                  onFileSelected$={$(() => {
                    // Preview only — do not write blob URL into block data
                  })}
                  onFileUploaded$={$(async (response) => {
                    // Store the full URL (not just the key) so renders work directly
                    const value = response.url || response.filePath;
                    if (value) {
                      await handleChange(field.name, value);
                    }
                  })}
                />
              </div>
            );
          }

          if (field.type === "tiles") {
            return (
              <TileEditor
                key={field.name}
                value={value || "[]"}
                onChange$={$((newValue: string) => {
                  handleChange(field.name, newValue);
                })}
                triggerSignal={props.triggerSignal}
                onSettled$={props.onSettled$}
              />
            );
          }

          if (field.type === "grid-layout") {
            return (
              <GridLayoutEditor
                key={field.name}
                value={value || ""}
                onChange$={$((newValue: string) => {
                  handleChange(field.name, newValue);
                })}
              />
            );
          }

          if (field.type === "color") {
            return (
              <div key={field.name}>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <input
                  type="color"
                  value={value || "#000000"}
                  class="w-full h-10 border border-gray-300 rounded-sm cursor-pointer"
                  onChange$={(e) => {
                    handleChange(
                      field.name,
                      (e.target as HTMLInputElement).value,
                    );
                  }}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
});
