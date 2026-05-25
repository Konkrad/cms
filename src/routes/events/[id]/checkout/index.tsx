import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  $,
} from "@qwik.dev/core";
import {
  routeLoader$,
  routeAction$,
  Form,
  z,
  zod$,
} from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import { FoodPreferenceStep, useSaveFoodPreference } from "~/components/setup/FoodPreferenceStep";
import { PhotoConsentStep, useSavePhotoConsent } from "~/components/setup/PhotoConsentStep";
import { inventoryGroupsService } from "~/services/inventory-groups.service";
import { productsService } from "~/services/products.service";
import { checkoutService } from "~/services/checkout.service";
import { stripeService } from "~/services/stripe.service";
import { publicImageUrlFromKey } from "~/utils/images";
import { getServerSession } from "~/utils/server-auth";
import { env } from "~/env";

export { useSaveFoodPreference, useSavePhotoConsent };

export const useProductsData = routeLoader$(async (event) => {
  const eventId = event.params.id;

  // Get all inventory groups with products
  const groups = await inventoryGroupsService.getByEventId(eventId);

  const now = new Date();

  // Calculate remaining capacity, sales window and available products for each group
  const groupsWithCapacity = await Promise.all(
    groups.map(async (group: any) => {
      const soldQuantity =
        group.products?.reduce(
          (sum: number, p: any) => sum + (p.soldQuantity || 0),
          0,
        ) || 0;
      const remainingCapacity = group.maxCapacity - soldQuantity;

      const salesStart = group.salesStartDate
        ? new Date(group.salesStartDate)
        : null;
      const salesEnd = group.salesEndDate ? new Date(group.salesEndDate) : null;
      const isSalesOpen =
        (!salesStart || salesStart <= now) && (!salesEnd || salesEnd >= now);

      // Determine which products are currently available:
      // - group sales window must be open
      // - group must have remaining capacity
      // - product must have remaining quantity (or unlimited if maxQuantity === 0)
      const availableProducts = (group.products || []).filter((p: any) => {
        const productRemaining =
          p.maxQuantity && p.maxQuantity > 0
            ? p.maxQuantity - (p.soldQuantity || 0)
            : Infinity;
        return isSalesOpen && remainingCapacity > 0 && productRemaining > 0;
      });

      return {
        ...group,
        remainingCapacity,
        soldQuantity,
        isSalesOpen,
        availableProducts,
      };
    }),
  );

  const session = await getServerSession(event);

  return {
    eventId,
    groups: groupsWithCapacity,
    stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY,
    foodPreference: (session as any)?.foodPreference ?? null,
    photoConsentGiven: (session as any)?.photoConsentGiven ?? null,
  };
});

export const useCreateCheckoutSession = routeAction$(
  async (data, event) => {
    console.log("[Server] useCreateCheckoutSession called");
    const eventId = event.params.id;

    // Check authentication for checkout
    const user = await getServerSession(event);
    if (!user) {
      return event.fail(401, { message: "Please log in to purchase tickets" });
    }

    // Get event and validate sales period
    const { eventsService } = await import("~/services/events.service");
    const eventData = await eventsService.getById(eventId);
    if (!eventData) {
      return event.fail(404, { message: "Event not found" });
    }

    // Validate sales period
    const salesValidation = await eventsService.validateSalesPeriod(eventData);
    if (!salesValidation.valid) {
      return event.fail(400, {
        message: salesValidation.reason || "Sales are not currently available",
      });
    }

    // Parse selected products
    const items = JSON.parse(data.items as string);
    console.log("[Server] Creating checkout session for items:", items);

    // Validate inventory
    const validation = await checkoutService.validateInventory(eventId, items);
    if (!validation.valid) {
      return event.fail(400, { message: validation.errors.join("; ") });
    }

    // Get product details for line items
    const products = await Promise.all(
      items.map(async (item: any) => {
        const product = await productsService.getById(item.productId);
        return { ...item, product };
      }),
    );

    // Calculate total amount
    const totalAmount = products.reduce((sum, p) => {
      return sum + p.product!.price * p.quantity * 100; // Convert to cents
    }, 0);

    // Handle free tickets - skip payment
    if (totalAmount === 0) {
      const { ticketsService } = await import("~/services/tickets.service");

      // Create free tickets directly
      const createdTickets = [];
      for (const item of items) {
        for (let i = 0; i < item.quantity; i++) {
          const ticket = await ticketsService.createFreeTicket({
            productId: item.productId,
            eventId,
            buyerId: user.id,
          });
          createdTickets.push(ticket);
        }
      }

      // Auto-upgrade participation status from "maybe" to "yes" for free tickets
      if (createdTickets.length > 0) {
        const { participationService } =
          await import("~/services/participation.service");
        try {
          await participationService.autoUpgradeToYes(user.id, eventId);
        } catch (error) {
          console.error("Failed to auto-upgrade participation status:", error);
          // Don't fail the transaction if participation update fails
        }
      }

      return {
        tickets: createdTickets,
      };
    }

    // Build line items for Stripe
    const lineItems = products
      .filter((p) => p.product)
      .map((p) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: p.product!.name,
            description: p.product!.features?.join(", ") || "",
            images: p.product!.imageKey ? [publicImageUrlFromKey(p.product!.imageKey)].filter(Boolean) : [],
          },
          unit_amount: Math.round(p.product!.price * 100), // Convert to cents
        },
        quantity: p.quantity,
      }));

    // Create Payment Intent directly
    const paymentIntent = await stripeService.stripe.paymentIntents.create({
      amount: Math.round(totalAmount),
      currency: "eur",
      metadata: {
        eventId,
        userId: user.id,
        items: JSON.stringify(items),
        line_items: JSON.stringify(lineItems), // Store line items for webhook
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log("[Server] Payment Intent created:", paymentIntent.id);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  },
  zod$({ items: z.string() }),
);

export const useCheckPaymentStatus = routeAction$(
  async (data, event) => {
    console.log("[Server] useCheckPaymentStatus called");

    try {
      const paymentIntent = await stripeService.stripe.paymentIntents.retrieve(
        data.payment_intent_id,
      );

      console.log("[Server] Payment Intent status:", paymentIntent.status);

      return {
        status: paymentIntent.status,
        succeeded: paymentIntent.status === "succeeded",
      };
    } catch (error: any) {
      console.error("[Server] Error retrieving payment intent:", error);
      return event.fail(400, {
        message: error.message || "Failed to retrieve payment status",
      });
    }
  },
  zod$({ payment_intent_id: z.string() }),
);

export default component$(() => {
  const data = useProductsData();
  const createCheckoutSession = useCreateCheckoutSession();
  const checkPaymentStatus = useCheckPaymentStatus();
  const saveFood = useSaveFoodPreference();
  const savePhoto = useSavePhotoConsent();

  const currentStep = useSignal<1 | 2 | 3>(1);
  const selectedProducts = useSignal<Record<string, number>>({});
  const clientSecret = useSignal<string>("");
  const paymentIntentId = useSignal<string>("");
  const stripeLoaded = useSignal(false);
  const checkoutMounted = useSignal(false);
  const isProcessing = useSignal(false);
  const paymentError = useSignal<string>("");
  const foodConsentReady = useSignal(data.value.foodPreference !== null);
  const photoConsentReady = useSignal(data.value.photoConsentGiven !== null);

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

  // Load Stripe.js and create checkout session when reaching step 2
  useVisibleTask$(async ({ track }) => {
    track(() => currentStep.value);

    if (currentStep.value === 2 && !stripeLoaded.value) {
      console.log("[Checkout] Creating checkout session");

      // Create checkout session using action
      const items = Object.entries(selectedProducts.value).map(
        ([productId, quantity]) => ({
          productId,
          quantity,
        }),
      );

      const result = await createCheckoutSession.submit({
        items: JSON.stringify(items),
      });

      console.log("[Checkout] Checkout session result:", result);

      // Handle free tickets
      if (result.value?.tickets) {
        console.log("[Checkout] Free tickets created, skipping to success");
        currentStep.value = 3;
        return;
      }

      // Handle paid tickets - load Stripe
      if (result.value?.clientSecret && result.value?.paymentIntentId) {
        console.log("[Checkout] Loading Stripe.js for paid tickets");

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

        clientSecret.value = result.value.clientSecret;
        paymentIntentId.value = result.value.paymentIntentId;
      }
    }
  });

  // Mount Stripe Payment Element when client secret is available
  useVisibleTask$(async ({ track, cleanup }) => {
    track(() => clientSecret.value);

    if (
      clientSecret.value &&
      !checkoutMounted.value &&
      typeof window !== "undefined" &&
      (window as any).Stripe
    ) {
      console.log("[Checkout] Mounting Stripe Payment Element");

      const stripe = (window as any).Stripe(data.value.stripePublishableKey);
      const elements = stripe.elements({ clientSecret: clientSecret.value });
      const paymentElement = elements.create("payment");

      const container = document.getElementById("checkout-element");
      if (container) {
        paymentElement.mount("#checkout-element");
        checkoutMounted.value = true;

        // Store stripe and elements for form submission
        (window as any).__stripeCheckout = { stripe, elements };

        cleanup(() => {
          paymentElement.unmount();
          checkoutMounted.value = false;
        });
      }
    }
  });

  const handlePaymentSubmit = $(async (e: Event) => {
    e.preventDefault();
    console.log("[Checkout] Handling payment submission");

    if (!(window as any).__stripeCheckout) {
      console.error("[Checkout] Stripe not initialized");
      paymentError.value = "Payment system not initialized";
      return;
    }

    isProcessing.value = true;
    paymentError.value = "";

    try {
      const { stripe, elements } = (window as any).__stripeCheckout;

      // Submit and confirm payment
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/events/${data.value.eventId}/checkout/success`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("[Checkout] Payment error:", error);
        paymentError.value = error.message || "Payment failed";
        isProcessing.value = false;
        return;
      }

      // Payment succeeded, start polling
      console.log("[Checkout] Payment submitted, polling for completion");
      isProcessing.value = false;
    } catch (error: any) {
      console.error("[Checkout] Unexpected error:", error);
      paymentError.value = "An unexpected error occurred";
      isProcessing.value = false;
    }
  });

  // Poll for payment completion
  useVisibleTask$(({ track, cleanup }) => {
    track(() => paymentIntentId.value);
    track(() => currentStep.value);

    if (currentStep.value === 2 && paymentIntentId.value) {
      console.log("[Checkout] Starting to poll for payment completion");

      const pollInterval = setInterval(async () => {
        const result = await checkPaymentStatus.submit({
          payment_intent_id: paymentIntentId.value,
        });

        if (result.value?.succeeded) {
          console.log("[Checkout] Payment completed!");
          clearInterval(pollInterval);
          currentStep.value = 3;
        }
      }, 2000); // Poll every 2 seconds

      cleanup(() => {
        clearInterval(pollInterval);
      });
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
                <div class="p-4 bg-gray-100 text-gray-600 rounded-sm text-center">
                  Sold Out
                </div>
              ) : !group.isSalesOpen ? (
                <div
                  class={`rounded-lg p-4 mb-4 ${
                    group.salesStartDate &&
                    new Date(group.salesStartDate) > new Date()
                      ? "bg-yellow-50 border border-yellow-200 text-yellow-700"
                      : "bg-red-50 border border-red-200 text-red-700"
                  }`}
                >
                  <div
                    class={`text-lg font-semibold mb-2 ${
                      group.salesStartDate &&
                      new Date(group.salesStartDate) > new Date()
                        ? "text-yellow-900"
                        : "text-red-900"
                    }`}
                  >
                    {group.salesStartDate &&
                    new Date(group.salesStartDate) > new Date()
                      ? "🕒 Sales Not Yet Open"
                      : "🔒 Sales Closed"}
                  </div>
                  <p
                    class={
                      group.salesStartDate &&
                      new Date(group.salesStartDate) > new Date()
                        ? "text-yellow-800"
                        : "text-red-800"
                    }
                  >
                    {group.salesStartDate &&
                    new Date(group.salesStartDate) > new Date()
                      ? `Opens ${new Date(group.salesStartDate).toLocaleString()}`
                      : group.salesEndDate
                        ? `Closed ${new Date(group.salesEndDate).toLocaleString()}`
                        : "Sales are not available for this group"}
                  </p>
                </div>
              ) : ((group.availableProducts as any[]) || []).length === 0 ? (
                <div class="p-4 bg-gray-100 text-gray-600 rounded-sm text-center">
                  No products available
                </div>
              ) : (
                <div class="space-y-4">
                  {((group.availableProducts as any[]) || []).map(
                    (product: any) => {
                      const isSelected = selectedProducts.value[product.id] > 0;

                      return (
                        <label
                          key={product.id}
                          class={`flex items-start gap-4 p-4 border rounded-sm cursor-pointer hover:bg-gray-50 ${isSelected ? "border-blue-500 bg-blue-50" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`group_${group.id}`}
                            value={product.id}
                            checked={isSelected}
                            class="mt-1"
                            onChange$={(e, el) => {
                              if (el.checked) {
                                // Clear other products in the same group (iterate all products to ensure cleanup)
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
                              {product.imageKey && (
                                <img
                                  src={publicImageUrlFromKey(product.imageKey) ?? undefined}
                                  alt={product.name}
                                  class="w-20 h-20 object-cover rounded-sm ml-4"
                                />
                              )}
                            </div>
                            <p class="text-sm text-gray-600 mt-2">
                              €{product.price.toFixed(2)} | Sold:{" "}
                              {product.soldQuantity} /{" "}
                              {product.maxQuantity || "∞"}
                            </p>
                          </div>
                        </label>
                      );
                    },
                  )}
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

          {/* Consent sections required before payment */}
          {data.value.foodPreference === null && (
            <FoodPreferenceStep
              initialPreference={null}
              updateAction={saveFood}
              onComplete$={$(() => { foodConsentReady.value = true; })}
            />
          )}

          {data.value.photoConsentGiven === null && (
            <PhotoConsentStep
              initialValue={null}
              updateAction={savePhoto}
              onComplete$={$(() => { photoConsentReady.value = true; })}
            />
          )}

          {/* Payment Form */}
          <div class="border rounded-lg p-6 bg-white">
            <h2 class="text-xl font-bold mb-4">Payment Details</h2>

            {paymentError.value && (
              <div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded-sm mb-4">
                {paymentError.value}
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
                  id="checkout-element"
                  class={clientSecret.value ? "" : "hidden"}
                ></div>
              </div>

              <div class="flex gap-4">
                <Button
                  type="button"
                  variant="secondary"
                  class="flex-1"
                  disabled={isProcessing.value}
                  onClick$={() => {
                    console.log("[Checkout] Going back to product selection");
                    currentStep.value = 1;
                    clientSecret.value = "";
                    paymentIntentId.value = "";
                    checkoutMounted.value = false;
                    paymentError.value = "";
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  class="flex-1"
                  disabled={!clientSecret.value || isProcessing.value || !foodConsentReady.value || !photoConsentReady.value}
                  onClick$={handlePaymentSubmit}
                >
                  {isProcessing.value ? (
                    <span class="flex items-center justify-center gap-2">
                      <span class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      Processing...
                    </span>
                  ) : (
                    "Complete Payment"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {currentStep.value === 3 && (
        <div class="space-y-6">
          <div class="border rounded-lg p-6 bg-white text-center">
            <div class="text-green-500 text-6xl mb-4">✓</div>
            <h2 class="text-3xl font-bold text-green-600 mb-4">
              Payment Successful!
            </h2>
            <p class="text-gray-600 text-lg mb-6">
              Thank you for your purchase. Your tickets have been generated.
            </p>
            <div class="p-6 bg-green-50 border border-green-200 rounded-sm">
              <h3 class="font-bold mb-2">What's Next?</h3>
              <ul class="text-left space-y-2 text-sm">
                <li>📧 Check your email for your tickets with QR codes</li>
                <li>
                  📱 Add the event to your calendar using the attached .ics file
                </li>
                <li>🎫 Present your QR code at the event for entry</li>
              </ul>
            </div>
            <div class="flex gap-4 justify-center mt-6">
              <a
                href={`/profile/tickets`}
                class="px-6 py-3 bg-blue-600 text-white rounded-sm hover:bg-blue-700"
              >
                View My Tickets
              </a>
              <a
                href={`/events/${data.value.eventId}`}
                class="px-6 py-3 border border-gray-300 rounded-sm hover:bg-gray-50"
              >
                Back to Event
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
