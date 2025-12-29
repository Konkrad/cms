import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { productsService } from "~/services/products.service";
import { checkoutService } from "~/services/checkout.service";
import { getServerSession } from "~/utils/server-auth";
import { ParticipantsCollection } from "~/components/events/ParticipantForm";

export const useProductsData = routeLoader$(async (event) => {
  const eventId = event.params.id;

  // Get all inventory groups with products
  const groups = await inventoryGroupsService.getByEventId(eventId);

  // Calculate remaining capacity for each group
  const groupsWithCapacity = await Promise.all(
    groups.map(async (group: any) => {
      const soldQuantity =
        group.products?.reduce(
          (sum: number, p: any) => sum + (p.soldQuantity || 0),
          0,
        ) || 0;
      const remainingCapacity = group.maxCapacity - soldQuantity;

      return {
        ...group,
        remainingCapacity,
        soldQuantity,
      };
    }),
  );

  return {
    eventId,
    groups: groupsWithCapacity,
  };
});

export const useProcessPayment = routeAction$(
  async (data, event) => {
    console.log("[Server] useProcessPayment called with data:", data);
    const eventId = event.params.id;

    // Check authentication for checkout
    const user = await getServerSession(event);
    console.log("[Server] User authenticated:", user ? user.id : "NO USER");

    if (!user) {
      return event.fail(401, { message: "Please log in to purchase tickets" });
    }

    const userId = user.id;

    // Parse selected products
    const items = Object.entries(data)
      .filter(([key]) => key.startsWith("product_"))
      .map(([key, value]) => {
        const productId = key.replace("product_", "");
        return {
          productId,
          quantity:
            typeof value === "number" ? value : parseInt(value as string, 10),
        };
      })
      .filter((item) => item.quantity > 0);

    console.log("[Server] Parsed items:", items);

    if (items.length === 0) {
      console.log("[Server] No items selected, returning error");
      return event.fail(400, { message: "Please select at least one product" });
    }

    // Validate inventory rules: one product per inventory group
    const productIds = items.map((i) => i.productId);
    const products = await Promise.all(
      productIds.map((id) => productsService.getById(id)),
    );

    const inventoryGroupIds = new Set(
      products.filter((p) => p).map((p) => p!.inventoryGroupId),
    );

    if (inventoryGroupIds.size !== items.length) {
      return event.fail(400, {
        message: "You can only select one product per inventory group",
      });
    }

    // Validate inventory
    const validation = await checkoutService.validateInventory(eventId, items);
    console.log("[Server] Inventory validation result:", validation);

    if (!validation.valid) {
      return event.fail(400, { message: validation.errors.join("; ") });
    }

    // Validate participant data for multi-participant products
    for (const item of items) {
      const product = products.find((p) => p?.id === item.productId);
      if (product && product.participantCapacity > 1) {
        // Check that we have participant data
        const participantKeys = Object.keys(data).filter((key) =>
          key.startsWith(`participant_${item.productId}_`)
        );
        
        const participantCount = new Set(
          participantKeys.map((key) => {
            const match = key.match(/participant_[^_]+_(\d+)_/);
            return match ? match[1] : null;
          }).filter(Boolean)
        ).size;

        if (participantCount !== product.participantCapacity) {
          return event.fail(400, {
            message: `Product "${product.name}" requires ${product.participantCapacity} participant details`,
          });
        }

        // Validate each participant has required fields
        for (let i = 1; i <= product.participantCapacity; i++) {
          const name = data[`participant_${item.productId}_${i}_name`];
          const email = data[`participant_${item.productId}_${i}_email`];

          if (!name || typeof name !== "string" || name.trim() === "") {
            return event.fail(400, {
              message: `Participant ${i} name is required for ${product.name}`,
            });
          }

          if (!email || typeof email !== "string" || email.trim() === "") {
            return event.fail(400, {
              message: `Participant ${i} email is required for ${product.name}`,
            });
          }

          // Basic email validation
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return event.fail(400, {
              message: `Participant ${i} email is invalid for ${product.name}`,
            });
          }
        }
      }
    }

    // TODO: Process payment with Stripe
    console.log("[Server] Payment processing would happen here");

    return {
      success: true,
      message: "Payment processed successfully",
    };
  },
  zod$(z.record(z.union([z.string(), z.number()]))),
);

export default component$(() => {
  const data = useProductsData();
  const processPayment = useProcessPayment();

  const currentStep = useSignal<1 | 2 | 3>(1);
  const selectedProducts = useSignal<Record<string, number>>({});
  const participantData = useSignal<Record<string, Array<{ name: string; email: string; phone?: string }>>>({});

  const calculateTotal = useComputed$(() => {
    let total = 0;
    for (const [productId, quantity] of Object.entries(
      selectedProducts.value,
    )) {
      const product = data.value.groups
        .flatMap((g) => g.products || [])
        .find((p) => p.id === productId);
      if (product) {
        total += product.price * quantity;
      }
    }
    return total;
  });

  const selectedProductDetails = useComputed$(() => {
    return Object.entries(selectedProducts.value)
      .map(([productId, quantity]) => {
        const product = data.value.groups
          .flatMap((g) => g.products || [])
          .find((p) => p.id === productId);
        return product ? { ...product, quantity } : null;
      })
      .filter((p) => p !== null);
  });

  const requiresParticipantData = useComputed$(() => {
    return selectedProductDetails.value.some(
      (p: any) => p.participantCapacity > 1
    );
  });

  return (
    <div class="max-w-4xl mx-auto p-6">
      <h1 class="text-3xl font-bold mb-6">Purchase Tickets</h1>

      {/* Step Indicator */}
      <div class="flex items-center justify-center mb-8">
        <div class="flex items-center">
          <div
            class={`flex items-center justify-center w-10 h-10 rounded-full ${
              currentStep.value === 1
                ? "bg-blue-600 text-white"
                : "bg-green-600 text-white"
            }`}
          >
            {currentStep.value > 1 ? "✓" : "1"}
          </div>
          <span
            class={`ml-2 font-medium ${currentStep.value === 1 ? "text-blue-600" : "text-gray-600"}`}
          >
            Select Products
          </span>
        </div>

        <div class="w-20 h-1 bg-gray-300 mx-2"></div>

        {requiresParticipantData.value && (
          <>
            <div class="flex items-center">
              <div
                class={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep.value === 2
                    ? "bg-blue-600 text-white"
                    : currentStep.value > 2
                      ? "bg-green-600 text-white"
                      : "bg-gray-300 text-gray-600"
                }`}
              >
                {currentStep.value > 2 ? "✓" : "2"}
              </div>
              <span
                class={`ml-2 font-medium ${currentStep.value === 2 ? "text-blue-600" : "text-gray-600"}`}
              >
                Participant Details
              </span>
            </div>

            <div class="w-20 h-1 bg-gray-300 mx-2"></div>
          </>
        )}

        <div class="flex items-center">
          <div
            class={`flex items-center justify-center w-10 h-10 rounded-full ${
              currentStep.value === (requiresParticipantData.value ? 3 : 2)
                ? "bg-blue-600 text-white"
                : "bg-gray-300 text-gray-600"
            }`}
          >
            {requiresParticipantData.value ? "3" : "2"}
          </div>
          <span
            class={`ml-2 font-medium ${currentStep.value === (requiresParticipantData.value ? 3 : 2) ? "text-blue-600" : "text-gray-600"}`}
          >
            Payment
          </span>
        </div>
      </div>

      {/* Step 1: Product Selection */}
      {currentStep.value === 1 && (
        <div class="space-y-6">
          {data.value.groups.map((group) => (
            <div key={group.id} class="border rounded-lg p-6 bg-white">
              <div class="mb-4">
                <h2 class="text-xl font-bold">{group.name}</h2>
                <p class="text-sm text-gray-600">
                  {group.remainingCapacity} of {group.maxCapacity} spots
                  remaining
                </p>
              </div>

              {group.remainingCapacity === 0 ? (
                <div class="p-4 bg-gray-100 text-gray-600 rounded text-center">
                  Sold Out
                </div>
              ) : (
                <div class="space-y-4">
                  {((group.products as any[]) || []).map((product: any) => {
                    const remaining = group.remainingCapacity;
                    const available = remaining > 0;
                    const isSelected = selectedProducts.value[product.id] > 0;

                    return (
                      <label
                        key={product.id}
                        class={`flex items-start gap-4 p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                          !available ? "opacity-50 cursor-not-allowed" : ""
                        } ${isSelected ? "border-blue-500 bg-blue-50" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`group_${group.id}`}
                          value={product.id}
                          disabled={!available}
                          checked={isSelected}
                          class="mt-1"
                          onChange$={(e, el) => {
                            if (el.checked) {
                              // Clear other products in the same group
                              const newSelection = {
                                ...selectedProducts.value,
                              };
                              ((group.products as any[]) || []).forEach(
                                (p: any) => {
                                  if (p.id !== product.id) {
                                    delete newSelection[p.id];
                                  }
                                },
                              );
                              newSelection[product.id] = 1;
                              console.log(
                                "[Checkout] Selected product:",
                                product.id,
                              );
                              selectedProducts.value = newSelection;
                            }
                          }}
                        />

                        <div class="flex-1">
                          <div class="flex justify-between items-start">
                            <div>
                              <h3 class="font-semibold">{product.name}</h3>
                              {product.features &&
                                product.features.length > 0 && (
                                  <ul class="text-sm text-gray-600 mt-1 space-y-1">
                                    {product.features.map(
                                      (feature: string, idx: number) => (
                                        <li key={idx}>• {feature}</li>
                                      ),
                                    )}
                                  </ul>
                                )}
                            </div>
                            {product.imageUrl && (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                class="w-20 h-20 object-cover rounded ml-4"
                              />
                            )}
                          </div>
                          <p class="text-lg font-bold mt-2">
                            €{product.price.toFixed(2)}
                          </p>
                          {product.maxQuantity > 0 && (
                            <p class="text-xs text-gray-500">
                              Max {product.maxQuantity} per purchase
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
            <div class="flex justify-between items-center mb-4">
              <span class="text-xl font-bold">Total:</span>
              <span class="text-2xl font-bold">
                €{calculateTotal.value.toFixed(2)}
              </span>
            </div>
            <Button
              class="w-full"
              disabled={Object.keys(selectedProducts.value).length === 0}
              onClick$={() => {
                console.log(
                  "[Checkout] Proceeding to next step with selection:",
                  selectedProducts.value,
                );
                // Initialize participant data for products that need it
                const newParticipantData: Record<string, Array<{ name: string; email: string; phone?: string }>> = {};
                selectedProductDetails.value.forEach((item: any) => {
                  if (item.participantCapacity > 1) {
                    newParticipantData[item.id] = Array.from(
                      { length: item.participantCapacity },
                      () => ({ name: "", email: "", phone: "" })
                    );
                  }
                });
                participantData.value = newParticipantData;
                
                // Skip to payment if no participant data needed
                currentStep.value = requiresParticipantData.value ? 2 : 3;
              }}
            >
              {requiresParticipantData.value ? "Continue to Participant Details" : "Proceed to Payment"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Participant Details (if needed) */}
      {currentStep.value === 2 && requiresParticipantData.value && (
        <div class="space-y-6">
          {selectedProductDetails.value
            .filter((item: any) => item.participantCapacity > 1)
            .map((item: any) => {
              const participants = participantData.value[item.id] || [];
              return (
                <div key={item.id} class="border rounded-lg p-6 bg-white">
                  <h2 class="text-xl font-bold mb-2">{item.name}</h2>
                  <p class="text-sm text-gray-600 mb-6">
                    Please provide details for all {item.participantCapacity} participants
                  </p>
                  
                  <ParticipantsCollection
                    capacity={item.participantCapacity}
                    participants={{
                      get value() {
                        return participantData.value[item.id] || [];
                      },
                      set value(v) {
                        participantData.value = {
                          ...participantData.value,
                          [item.id]: v,
                        };
                      },
                    } as any}
                  />
                </div>
              );
            })}

          <div class="sticky bottom-0 bg-white border-t pt-4 pb-2">
            <div class="flex gap-4">
              <Button
                type="button"
                variant="secondary"
                class="flex-1"
                onClick$={() => {
                  currentStep.value = 1;
                }}
              >
                Back to Products
              </Button>
              <Button
                class="flex-1"
                onClick$={() => {
                  // Validate all participants have required data
                  let isValid = true;
                  for (const item of selectedProductDetails.value) {
                    const itemAny = item as any;
                    if (itemAny.participantCapacity > 1) {
                      const participants = participantData.value[itemAny.id] || [];
                      for (let i = 0; i < itemAny.participantCapacity; i++) {
                        const p = participants[i];
                        if (!p || !p.name || !p.email) {
                          isValid = false;
                          break;
                        }
                      }
                    }
                    if (!isValid) break;
                  }
                  
                  if (!isValid) {
                    alert("Please fill in all required participant information");
                    return;
                  }
                  
                  currentStep.value = 3;
                }}
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 (or 2): Payment */}
      {currentStep.value === (requiresParticipantData.value ? 3 : 2) && (
        <div class="space-y-6">
          {/* Order Summary */}
          <div class="border rounded-lg p-6 bg-white">
            <h2 class="text-xl font-bold mb-4">Order Summary</h2>
            <div class="space-y-3">
              {selectedProductDetails.value.map((item: any) => (
                <div key={item.id} class="flex justify-between items-center">
                  <div>
                    <p class="font-medium">{item.name}</p>
                    <p class="text-sm text-gray-600">
                      Quantity: {item.quantity}
                    </p>
                  </div>
                  <p class="font-bold">
                    €{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
              <div class="border-t pt-3 mt-3 flex justify-between items-center">
                <span class="text-lg font-bold">Total:</span>
                <span class="text-2xl font-bold">
                  €{calculateTotal.value.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div class="border rounded-lg p-6 bg-white">
            <h2 class="text-xl font-bold mb-4">Payment Details</h2>

            {processPayment.value?.failed && (
              <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
                {processPayment.value.message}
              </div>
            )}

            {processPayment.value?.success && (
              <div class="p-4 bg-green-100 border border-green-400 text-green-700 rounded mb-4">
                {processPayment.value.message}
              </div>
            )}

            <Form action={processPayment} class="space-y-4">
              {/* Hidden inputs for selected products */}
              {Object.entries(selectedProducts.value).map(
                ([productId, quantity]) => (
                  <input
                    key={productId}
                    type="hidden"
                    name={`product_${productId}`}
                    value={quantity}
                  />
                ),
              )}

              {/* Hidden inputs for participant data */}
              {Object.entries(participantData.value).map(([productId, participants]) =>
                participants.map((participant, index) => (
                  <div key={`${productId}_${index}`}>
                    <input
                      type="hidden"
                      name={`participant_${productId}_${index + 1}_name`}
                      value={participant.name}
                    />
                    <input
                      type="hidden"
                      name={`participant_${productId}_${index + 1}_email`}
                      value={participant.email}
                    />
                    {participant.phone && (
                      <input
                        type="hidden"
                        name={`participant_${productId}_${index + 1}_phone`}
                        value={participant.phone}
                      />
                    )}
                  </div>
                ))
              )}

              {/* TODO: Add Stripe Elements here */}
              <div class="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded text-center text-gray-600">
                <p class="mb-2 font-medium">Stripe Payment Integration</p>
                <p class="text-sm">Payment form will be integrated here</p>
              </div>

              <div class="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  class="flex-1"
                  onClick$={() => {
                    console.log("[Checkout] Going back");
                    currentStep.value = requiresParticipantData.value ? 2 : 1;
                  }}
                >
                  Back
                </Button>
                <Button type="submit" class="flex-1">
                  Complete Payment
                </Button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});
