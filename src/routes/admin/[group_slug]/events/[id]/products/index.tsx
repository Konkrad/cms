import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import {
  Form,
  routeAction$,
  routeLoader$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { productsService } from "~/services/products.service";
import { InventoryGroupForm } from "~/components/admin/InventoryGroupForm";
import { ProductForm } from "~/components/admin/ProductForm";

export const useInventoryGroupsAndProducts = routeLoader$(async (event) => {
  const eventId = event.params.id;
  const groups = await inventoryGroupsService.getByEventId(eventId);
  return {
    groups: groups as Array<{
      id: string;
      eventId: string;
      name: string;
      maxCapacity: number;
      needsTicket: boolean;
      salesStartDate?: string | null;
      salesEndDate?: string | null;
      createdAt: string;
      products?: any[];
    }>,
    eventId,
  };
});

export const useCreateInventoryGroup = routeAction$(
  async (data, event) => {
    try {
      const eventId = event.params.id;

      // Validate and transform form data
      // Note: We don't need explicit validation here since zod$ handles it
      const validatedData = data;

      await inventoryGroupsService.create({
        eventId,
        name: validatedData.name.trim(),
        maxCapacity: validatedData.maxCapacity,
        needsTicket: validatedData.needsTicket,
        salesStartDate: validatedData.salesStartDate || undefined,
        salesEndDate: validatedData.salesEndDate || undefined,
      });
      return { success: true };
    } catch (error) {
      console.error("Failed to create inventory group:", error);
      return event.fail(500, { message: "Failed to create inventory group" });
    }
  },
  zod$((zod) =>
    zod
      .object({
        name: z.string().min(1, "Group name is required"),
        maxCapacity: z
          .union([
            z.string().transform((val) => parseInt(val, 10)),
            z.number().int(),
          ])
          .pipe(
            z.number().int().positive("Max capacity must be greater than 0"),
          ),
        needsTicket: z
          .union([
            z.string().transform((val) => val === "on" || val === "true"),
            z.boolean(),
          ])
          .default(true),
        salesStartDate: z
          .union([
            z
              .string()
              .transform((val) =>
                val === "" ? undefined : new Date(val).toISOString(),
              ),
            z.coerce.date().transform((d) => d.toISOString()),
          ])
          .optional(),
        salesEndDate: z
          .union([
            z
              .string()
              .transform((val) =>
                val === "" ? undefined : new Date(val).toISOString(),
              ),
            z.coerce.date().transform((d) => d.toISOString()),
          ])
          .optional(),
      })
      .superRefine((data, ctx) => {
        if (data.salesStartDate && data.salesEndDate) {
          if (new Date(data.salesStartDate) > new Date(data.salesEndDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Sales start date must be before sales end date",
              path: ["salesStartDate"],
            });
          }
        }
      }),
  ),
);

export const useCreateProduct = routeAction$(
  async (data, event) => {
    try {
      const eventId = event.params.id;

      // Validate and transform form data
      // Note: We don't need explicit validation here since zod$ handles it
      const validatedData = data;

      // Convert features string to array
      const features = validatedData.features
        ? validatedData.features
            .split(",")
            .map((f: string) => f.trim())
            .filter((f: string) => f.length > 0)
        : [];

      await productsService.create({
        eventId,
        inventoryGroupId: validatedData.inventoryGroupId,
        name: validatedData.name.trim(),
        price: validatedData.price,
        maxQuantity: validatedData.maxQuantity,
        participantCapacity: validatedData.participantCapacity,
        features,
        imageUrl: validatedData.imageUrl || undefined,
      });
      return { success: true };
    } catch (error) {
      console.error("Failed to create product:", error);
      return event.fail(500, {
        message: "Failed to create product. Please try again.",
      });
    }
  },
  zod$((zod) =>
    zod.object({
      inventoryGroupId: z.string().uuid("Invalid inventory group"),
      name: z.string().min(1, "Product name is required"),
      price: z
        .union([z.string().transform((val) => parseFloat(val)), z.number()])
        .pipe(z.number().min(0, "Price cannot be negative")),
      maxQuantity: z
        .union([
          z.string().transform((val) => parseInt(val, 10)),
          z.number().int(),
        ])
        .pipe(z.number().int().min(0, "Max quantity cannot be negative")),
      participantCapacity: z
        .union([
          z.string().transform((val) => parseInt(val, 10)),
          z.number().int(),
        ])
        .pipe(
          z.number().int().min(1, "Participant capacity must be at least 1"),
        )
        .default(1),
      features: z.string().default(""),
      imageUrl: z
        .string()
        .url("Invalid image URL")
        .optional()
        .or(z.literal("")),
    }),
  ),
);

export default component$(() => {
  const data = useInventoryGroupsAndProducts();
  const createGroup = useCreateInventoryGroup();
  const createProduct = useCreateProduct();

  const showGroupForm = useSignal(false);
  const showProductForm = useSignal(false);
  const selectedGroupId = useSignal<string>("");
  const errorMessage = useSignal("");
  const successMessage = useSignal("");

  // Handle action results
  useTask$(({ track }) => {
    track(() => createGroup.value);
    track(() => createProduct.value);

    if (createGroup.value?.success) {
      successMessage.value = "Inventory group created successfully!";
      showGroupForm.value = false;
      setTimeout(() => (successMessage.value = ""), 3000);
    } else if (createGroup.value?.failed) {
      errorMessage.value =
        createGroup.value.message || "Failed to create inventory group";
      setTimeout(() => (errorMessage.value = ""), 5000);
    }

    if (createProduct.value?.success) {
      successMessage.value = "Product created successfully!";
      showProductForm.value = false;
      setTimeout(() => (successMessage.value = ""), 3000);
    } else if (createProduct.value?.failed) {
      errorMessage.value =
        createProduct.value.message || "Failed to create product";
      setTimeout(() => (errorMessage.value = ""), 5000);
    }
  });

  return (
    <div class="space-y-8">
      {/* Success/Error Messages */}
      {successMessage.value && (
        <div class="p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage.value}
        </div>
      )}
      {errorMessage.value && (
        <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {errorMessage.value}
        </div>
      )}

      <div>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">Inventory Groups & Products</h2>
          <Button onClick$={() => (showGroupForm.value = !showGroupForm.value)}>
            {showGroupForm.value ? "Cancel" : "New Inventory Group"}
          </Button>
        </div>

        {showGroupForm.value && (
          <InventoryGroupForm
            action={createGroup}
            onCancel={$(function (): void {
              showGroupForm.value = false;
            })}
          />
        )}

        {data.value.groups.length === 0 && !showGroupForm.value && (
          <div class="p-8 text-center text-gray-500 border rounded">
            <p class="mb-2">No inventory groups yet.</p>
            <p class="text-sm">
              Create an inventory group to start adding products.
            </p>
          </div>
        )}

        {data.value.groups.map((group) => (
          <div key={group.id} class="mb-6 p-4 border rounded bg-white">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="text-lg font-bold">{group.name}</h3>
                <p class="text-sm text-gray-600">
                  Capacity: {group.maxCapacity} | Needs Ticket:{" "}
                  {group.needsTicket ? "Yes" : "No"}
                </p>
                {(group.salesStartDate || group.salesEndDate) && (
                  <p class="text-sm text-gray-600 mt-1">
                    Sales:{" "}
                    {group.salesStartDate
                      ? new Date(group.salesStartDate).toLocaleString()
                      : "—"}
                    {group.salesEndDate
                      ? ` - ${new Date(group.salesEndDate).toLocaleString()}`
                      : ""}
                  </p>
                )}
              </div>
              <Button
                onClick$={() => {
                  selectedGroupId.value = group.id;
                  showProductForm.value = true;
                }}
              >
                Add Product
              </Button>
            </div>

            {group.products && group.products.length > 0 ? (
              <div class="space-y-2">
                <h4 class="font-semibold text-sm text-gray-700">Products:</h4>
                {group.products.map((product) => (
                  <div
                    key={product.id}
                    class="p-3 bg-gray-50 rounded flex gap-4"
                  >
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        class="w-16 h-16 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div class="flex-1">
                      <p class="font-medium">{product.name}</p>
                      <p class="text-sm text-gray-600">
                        €{product.price.toFixed(2)} | Sold:{" "}
                        {product.soldQuantity} / {product.maxQuantity || "∞"}
                      </p>
                      {product.features && product.features.length > 0 && (
                        <p class="text-xs text-gray-500 mt-1">
                          {product.features.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p class="text-sm text-gray-500 italic">
                No products yet. Add one to get started.
              </p>
            )}
          </div>
        ))}
      </div>

      {showProductForm.value && (
        <ProductForm
          action={createProduct}
          inventoryGroups={data.value.groups.map((g) => ({
            id: g.id,
            name: g.name,
          }))}
          selectedGroupId={selectedGroupId.value}
          onCancel={$(function (): void {
            showProductForm.value = false;
          })}
        />
      )}
    </div>
  );
});
