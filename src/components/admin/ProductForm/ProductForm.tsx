import { component$, useSignal, type QRL } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Modal } from "~/components/ui/Modal";
import { ImageUploader } from "~/components/ui/ImageUploader/ImageUploader";
import { publicImageUrlFromKey } from "~/utils/images";

interface ProductFormProps {
  action: any;
  inventoryGroups: Array<{ id: string; name: string }>;
  selectedGroupId?: string;
  onCancel: QRL<() => void>;
}

export const ProductForm = component$<ProductFormProps>(
  ({ action, inventoryGroups, selectedGroupId, onCancel }) => {
    const uploadTrigger = useSignal(false);
    const currentImageKey = useSignal("");

    return (
      <Modal open={true} onClose$={onCancel} title="New Product" size="md">
        <Form action={action}>
          <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">
                  Inventory Group *
                </label>
                <select
                  name="inventoryGroupId"
                  class="w-full border rounded-sm px-3 py-2"
                  required
                >
                  {inventoryGroups.map((group) => (
                    <option
                      key={group.id}
                      value={group.id}
                      selected={group.id === selectedGroupId}
                    >
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input name="name" label="Product Name" required />

              <Input
                name="price"
                label="Price (EUR)"
                type="number"
                step="0.01"
                min="0"
                required
              />

              <Input
                name="maxQuantity"
                label="Max Quantity per Purchase"
                type="number"
                min="0"
                placeholder="0 = unlimited"
                required
              />

              <Input
                name="participantCapacity"
                label="Participant Capacity"
                type="number"
                min="1"
                value="1"
                placeholder="Number of participants per product unit"
                required
              />

              <div>
                <label class="block text-sm font-medium mb-1">
                  Features (comma-separated)
                </label>
                <textarea
                  name="features"
                  class="w-full border rounded-sm px-3 py-2"
                  rows={3}
                  placeholder="Feature 1, Feature 2, Feature 3"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">
                  Product Image
                </label>
                <ImageUploader
                  path="public/products"
                  pipeline="standard"
                  name="imageKey"
                  triggerSignal={uploadTrigger}
                  aspectRatio="1/1"
                  crop
                  cropAspectRatio="1/1"
                  onFileUploaded$={(response: any) => {
                    if (response.filePath) {
                      currentImageKey.value = response.filePath;
                    }
                  }}
                  currentUrl={currentImageKey.value ? publicImageUrlFromKey(currentImageKey.value) ?? undefined : undefined}
                  currentValue={currentImageKey.value}
                />
              </div>

              <div class="flex gap-2 pt-2">
                <Button 
                  type="submit"
                  onClick$={() => {
                    uploadTrigger.value = true;
                  }}
                >
                  Create Product
                </Button>
                <Button type="button" onClick$={onCancel}>
                  Cancel
                </Button>
              </div>
            </div>
        </Form>
      </Modal>
    );
  },
);
