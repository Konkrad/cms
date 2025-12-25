import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  $,
} from "@builder.io/qwik";
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
import { stripeService } from "~/services/stripe.service";
import { getServerSession } from "~/utils/server-auth";
import { env } from "~/env";

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
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY,
  };
});

export const useCreatePaymentIntent = routeAction$(
  async (data, event) => {
    console.log("[Server] useCreatePaymentIntent called");
    const eventId = event.params.id;

    // Check authentication for checkout
    const user = await getServerSession(event);
    if (!user) {
      return event.fail(401, { message: "Please log in to purchase tickets" });
    }

    // Parse selected products
    const items = JSON.parse(data.items as string);
    console.log("[Server] Creating payment intent for items:", items);

    // Validate inventory
    const validation = await checkoutService.validateInventory(eventId, items);
    if (!validation.valid) {
      return event.fail(400, { message: validation.errors.join("; ") });
    }

    // Get product details to calculate amount
    const products = await Promise.all(
      items.map(async (item: any) => {
        const product = await productsService.getById(item.productId);
        return { ...item, product };
      }),
    );

    const totalAmount = products.reduce((sum, p) => {
      return sum + p.product!.price * p.quantity * 100; // Convert to cents
    }, 0);

    // Create Stripe payment intent
    const paymentIntent = await stripeService.stripe.paymentIntents.create({
      amount: Math.round(totalAmount),
      currency: "eur",
      metadata: {
        eventId,
        userId: user.id,
        items: JSON.stringify(items),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log("[Server] Payment intent created:", paymentIntent.id);

    return {
      clientSecret: paymentIntent.client_secret,
    };
  },
  zod$({ items: z.string() }),
);

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

    // Parse selected products from items JSON
    const items = JSON.parse(data.items as string);
    console.log("[Server] Parsed items:", items);

    if (items.length === 0) {
      console.log("[Server] No items selected, returning error");
      return event.fail(400, { message: "Please select at least one product" });
    }

    // Validate inventory rules: one product per inventory group
    const productIds = items.map((i: any) => i.productId);
    const products = await Promise.all(
      productIds.map((id: string) => productsService.getById(id)),
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

    // Retrieve and verify payment intent from Stripe
    const paymentIntentId = data.payment_intent_id as string;
    console.log("[Server] Retrieving payment intent:", paymentIntentId);

    try {
      const paymentIntent =
        await stripeService.stripe.paymentIntents.retrieve(paymentIntentId);

      console.log("[Server] Payment intent status:", paymentIntent.status);

      if (paymentIntent.status !== "succeeded") {
        return event.fail(400, {
          message: "Payment has not been completed",
        });
      }

      // TODO: Create transaction record and tickets
      console.log("[Server] Payment verified, would create transaction here");

      return {
        success: true,
        message: "Payment processed successfully",
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error("[Server] Error retrieving payment intent:", error);
      return event.fail(500, {
        message: "Failed to verify payment",
      });
    }
  },
  zod$({ payment_intent_id: z.string(), items: z.string() }),
);

export default component$(() => {
  const data = useProductsData();
  const createPaymentIntent = useCreatePaymentIntent();
  const processPayment = useProcessPayment();

  const currentStep = useSignal<1 | 2>(1);
  const selectedProducts = useSignal<Record<string, number>>({});
  const clientSecret = useSignal<string>("");
  const stripeLoaded = useSignal(false);
  const paymentElementMounted = useSignal(false);

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

  // Load Stripe.js and create payment intent when reaching step 2
  useVisibleTask$(async ({ track }) => {
    track(() => currentStep.value);

    if (currentStep.value === 2 && !stripeLoaded.value) {
      console.log("[Checkout] Loading Stripe.js");

      // Load Stripe.js script
      if (!document.querySelector('script[src*="stripe.com/v3"]')) {
        const script = document.createElement("script");
        script.src = "https://js.stripe.com/v3/";
        script.async = true;
        document.head.appendChild(script);

        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      stripeLoaded.value = true;
      console.log("[Checkout] Stripe.js loaded");

      // Create payment intent using action
      console.log("[Checkout] Creating payment intent");
      const items = Object.entries(selectedProducts.value).map(
        ([productId, quantity]) => ({
          productId,
          quantity,
        }),
      );

      const result = await createPaymentIntent.submit({
        items: JSON.stringify(items),
      });

      console.log("[Checkout] Payment intent result:", result);

      if (result.value?.clientSecret) {
        clientSecret.value = result.value.clientSecret;
      }
    }
  });

  // Mount Stripe Payment Element when client secret is available
  useVisibleTask$(async ({ track, cleanup }) => {
    track(() => clientSecret.value);

    if (
      clientSecret.value &&
      !paymentElementMounted.value &&
      typeof window !== "undefined" &&
      (window as any).Stripe
    ) {
      console.log("[Checkout] Mounting Stripe Payment Element");

      const stripe = (window as any).Stripe(data.value.stripePublishableKey);
      const elements = stripe.elements({ clientSecret: clientSecret.value });
      const paymentElement = elements.create("payment");

      const container = document.getElementById("payment-element");
      if (container) {
        paymentElement.mount("#payment-element");
        paymentElementMounted.value = true;

        // Store stripe and elements for form submission
        (window as any).__stripeCheckout = { stripe, elements };

        cleanup(() => {
          paymentElement.unmount();
          paymentElementMounted.value = false;
        });
      }
    }
  });

  const handlePaymentSubmit = $(async (e: Event) => {
    e.preventDefault();
    console.log("[Checkout] Handling payment submission");

    if (!(window as any).__stripeCheckout) {
      console.error("[Checkout] Stripe not initialized");
      return;
    }

    const { stripe, elements } = (window as any).__stripeCheckout;

    // Submit the payment to Stripe
    const { error: submitError } = await elements.submit();
    if (submitError) {
      console.error("[Checkout] Payment submission error:", submitError);
      alert(submitError.message);
      return;
    }

    // Confirm payment on server side
    const items = Object.entries(selectedProducts.value).map(
      ([productId, quantity]) => ({
        productId,
        quantity,
      }),
    );

    const result = await processPayment.submit({
      payment_intent_id: clientSecret.value.split("_secret_")[0],
      items: JSON.stringify(items),
    });

    if (result.value?.failed) {
      console.error("[Checkout] Payment failed:", result.value.message);
      alert(result.value.message);
    } else if (result.value?.success) {
      console.log("[Checkout] Payment successful");
      // TODO: Show success message or redirect
      alert("Payment successful!");
    }
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
            {currentStep.value === 2 ? "✓" : "1"}
          </div>
          <span
            class={`ml-2 font-medium ${currentStep.value === 1 ? "text-blue-600" : "text-gray-600"}`}
          >
            Select Products
          </span>
        </div>

        <div class="w-24 h-1 bg-gray-300 mx-4"></div>

        <div class="flex items-center">
          <div
            class={`flex items-center justify-center w-10 h-10 rounded-full ${
              currentStep.value === 2
                ? "bg-blue-600 text-white"
                : "bg-gray-300 text-gray-600"
            }`}
          >
            2
          </div>
          <span
            class={`ml-2 font-medium ${currentStep.value === 2 ? "text-blue-600" : "text-gray-600"}`}
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
                  "[Checkout] Proceeding to payment step with selection:",
                  selectedProducts.value,
                );
                currentStep.value = 2;
              }}
            >
              Proceed to Payment
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Payment */}
      {currentStep.value === 2 && (
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

            <div class="space-y-4">
              {/* Stripe Payment Element */}
              <div class="space-y-4">
                {!clientSecret.value && (
                  <div class="p-8 text-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p class="text-sm text-gray-600">Loading payment form...</p>
                  </div>
                )}

                <div
                  id="payment-element"
                  class={clientSecret.value ? "" : "hidden"}
                ></div>
              </div>

              <div class="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  class="flex-1"
                  onClick$={() => {
                    console.log("[Checkout] Going back to product selection");
                    currentStep.value = 1;
                    clientSecret.value = "";
                    paymentElementMounted.value = false;
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  class="flex-1"
                  disabled={!clientSecret.value}
                  onClick$={handlePaymentSubmit}
                >
                  Complete Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
