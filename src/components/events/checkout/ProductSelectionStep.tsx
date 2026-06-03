import { component$ } from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import type { ParticipantAssignmentUnit } from "./types";
import { publicImageUrlFromKey } from "~/utils/images";

type ProductSelectionStepProps = {
  groups: any[];
  selectedProducts: Record<string, number>;
  selectedProductDetails: any[];
  canProceedFromProducts: boolean;
  totalTickets: number;
  total: number;
  buyer: {
    id: string;
    name: string;
    email: string;
  };
  onSelectionChange$: (next: Record<string, number>) => void;
  onContinue$: (units: ParticipantAssignmentUnit[]) => void;
};

export const ProductSelectionStep = component$<ProductSelectionStepProps>(
  ({
    groups,
    selectedProducts,
    selectedProductDetails,
    canProceedFromProducts,
    totalTickets,
    total,
    buyer,
    onSelectionChange$,
    onContinue$,
  }) => {
    return (
      <div class="space-y-6">
        {groups.map((group) => (
          <div key={group.id} class="border rounded-lg p-6 bg-white">
            <div class="mb-4">
              <h2 class="text-xl font-bold">{group.name}</h2>
              <p class="text-sm text-gray-600">
                {group.remainingCapacity} of {group.maxCapacity} spots remaining
              </p>
            </div>

            {group.remainingCapacity === 0 ? (
              <div class="p-4 bg-gray-100 text-gray-600 rounded-sm text-center">Sold Out</div>
            ) : !group.isSalesOpen ? (
              <div
                class={`rounded-lg p-4 mb-4 ${
                  group.salesStartDate && new Date(group.salesStartDate) > new Date()
                    ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                <div
                  class={`text-lg font-semibold mb-2 ${
                    group.salesStartDate && new Date(group.salesStartDate) > new Date()
                      ? "text-yellow-900"
                      : "text-red-900"
                  }`}
                >
                  {group.salesStartDate && new Date(group.salesStartDate) > new Date()
                    ? "🕒 Sales Not Yet Open"
                    : "🔒 Sales Closed"}
                </div>
                <p
                  class={
                    group.salesStartDate && new Date(group.salesStartDate) > new Date()
                      ? "text-yellow-800"
                      : "text-red-800"
                  }
                >
                  {group.salesStartDate && new Date(group.salesStartDate) > new Date()
                    ? `Opens ${new Date(group.salesStartDate).toLocaleString()}`
                    : group.salesEndDate
                      ? `Closed ${new Date(group.salesEndDate).toLocaleString()}`
                      : "Sales are not available for this group"}
                </p>
              </div>
            ) : ((group.availableProducts as any[]) || []).length === 0 ? (
              <div class="p-4 bg-gray-100 text-gray-600 rounded-sm text-center">No products available</div>
            ) : (
              <div class="space-y-4">
                {((group.availableProducts as any[]) || []).map((product: any) => {
                  const isSelected = selectedProducts[product.id] > 0;
                  const productRemaining =
                    product.maxQuantity && product.maxQuantity > 0
                      ? product.maxQuantity - (product.soldQuantity || 0)
                      : group.remainingCapacity;
                  const maxSelectable = Math.max(1, Math.min(group.remainingCapacity, productRemaining));
                  const quantity = selectedProducts[product.id] || 0;

                  return (
                    <div
                      key={product.id}
                      class={`flex items-center gap-4 p-4 border rounded-sm cursor-pointer hover:bg-gray-50 ${isSelected ? "border-blue-500 bg-blue-50" : ""}`}
                      onClick$={() => {
                        const next = { ...selectedProducts };
                        ((group.products as any[]) || []).forEach((p: any) => {
                          if (p.id !== product.id) {
                            delete next[p.id];
                          }
                        });
                        next[product.id] = Math.max(1, selectedProducts[product.id] || 1);
                        onSelectionChange$(next);
                      }}
                    >
                      <input
                        type="radio"
                        name={`group_${group.id}`}
                        value={product.id}
                        checked={isSelected}
                        class="mt-1"
                        onClick$={(e) => {
                          e.stopPropagation();
                        }}
                        onChange$={(_, el) => {
                          if (!el.checked) return;
                          const next = { ...selectedProducts };
                          ((group.products as any[]) || []).forEach((p: any) => {
                            if (p.id !== product.id) {
                              delete next[p.id];
                            }
                          });
                          next[product.id] = Math.max(1, selectedProducts[product.id] || 1);
                          onSelectionChange$(next);
                        }}
                      />

                      <div class="flex-1">
                        <div class="flex justify-between items-center gap-4">
                          <div class="min-w-0">
                            <h3 class="font-semibold">{product.name}</h3>
                            {product.features && product.features.length > 0 && (
                              <ul class="text-sm text-gray-600 mt-1 space-y-1">
                                {product.features.map((feature: string, idx: number) => (
                                  <li key={idx}>• {feature}</li>
                                ))}
                              </ul>
                            )}
                            <p class="text-sm text-gray-600 mt-2">
                              €{product.price.toFixed(2)} | Sold: {product.soldQuantity} / {product.maxQuantity || "∞"}
                            </p>
                          </div>

                          {isSelected && maxSelectable > 1 && (
                            <div class="shrink-0">
                              <div class="inline-flex items-center bg-black text-white rounded-full overflow-hidden">
                                <button
                                  type="button"
                                  class="w-8 h-8 text-lg leading-none hover:bg-gray-800"
                                  onClick$={(e) => {
                                    e.stopPropagation();
                                    const current = selectedProducts[product.id] || 1;
                                    onSelectionChange$({
                                      ...selectedProducts,
                                      [product.id]: Math.max(1, current - 1),
                                    });
                                  }}
                                  disabled={quantity <= 1}
                                >
                                  -
                                </button>
                                <span class="h-8 min-w-8 px-2 bg-white text-black text-sm font-semibold flex items-center justify-center">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  class="w-8 h-8 text-lg leading-none hover:bg-gray-800"
                                  onClick$={(e) => {
                                    e.stopPropagation();
                                    const current = selectedProducts[product.id] || 1;
                                    onSelectionChange$({
                                      ...selectedProducts,
                                      [product.id]: Math.min(maxSelectable, current + 1),
                                    });
                                  }}
                                  disabled={quantity >= maxSelectable}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          {product.imageKey && (
                            <img
                              src={publicImageUrlFromKey(product.imageKey) ?? undefined}
                              alt={product.name}
                              class="w-20 h-20 object-cover rounded-sm ml-4"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
          <div class="flex justify-between items-center mb-4">
            <span class="text-xl font-bold">Total:</span>
            <span class="text-2xl font-bold">€{total.toFixed(2)}</span>
          </div>
          <Button
            class="w-full"
            disabled={!canProceedFromProducts}
            onClick$={() => {
              const units: ParticipantAssignmentUnit[] = [];

              for (const item of selectedProductDetails) {
                const quantity = Number(item.quantity) || 0;
                const capacityRaw = Number(item.participantCapacity ?? 1);
                const capacity = Math.max(1, Number.isFinite(capacityRaw) ? capacityRaw : 1);

                for (let unitNumber = 1; unitNumber <= quantity; unitNumber++) {
                  const isFirstUnitOfProduct = unitNumber === 1;
                  const slots = Array.from({ length: capacity }, (_, slotIdx) => ({
                    name: isFirstUnitOfProduct && slotIdx === 0 ? buyer.name : "",
                    email: isFirstUnitOfProduct && slotIdx === 0 ? buyer.email : "",
                    existingUserId: isFirstUnitOfProduct && slotIdx === 0 ? buyer.id : null,
                    locked: isFirstUnitOfProduct && slotIdx === 0,
                  }));

                  units.push({
                    unitKey: `${item.id}-${unitNumber}`,
                    productId: item.id,
                    productName: item.name,
                    unitNumber,
                    slots,
                  });

                }
              }

              onContinue$(units);
            }}
          >
            Continue to Participants ({totalTickets} tickets)
          </Button>
        </div>
      </div>
    );
  },
);
