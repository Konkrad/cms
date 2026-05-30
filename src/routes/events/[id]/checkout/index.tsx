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
import { publicImageUrlFromKey, deriveThumbnailKey } from "~/utils/images";
import { getServerSession } from "~/utils/server-auth";
import { isValidEmail, validateParticipantSlots } from "~/utils/participant-validation";
import { env } from "~/env";
import { StepIndicator } from "~/components/events/checkout/StepIndicator";
import { ProductSelectionStep } from "~/components/events/checkout/ProductSelectionStep";
import { ParticipantAssignmentStep } from "~/components/events/checkout/ParticipantAssignmentStep";
import type {
  CheckoutItemInput,
  GroupedAssignments,
  ParticipantAssignmentUnit,
  ParticipantSlotInput,
} from "~/components/events/checkout/types";

export { useSaveFoodPreference, useSavePhotoConsent };

function splitIntoChunks(value: string, maxChunkSize = 450): string[] {
  if (!value) return [];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += maxChunkSize) {
    chunks.push(value.slice(i, i + maxChunkSize));
  }
  return chunks;
}

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
    buyer: {
      id: (session as any)?.id ?? "",
      name: [
        (session as any)?.name,
        (session as any)?.familyName,
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      email: (session as any)?.email ?? "",
      avatarUrl: (session as any)?.profilePicture
        ? publicImageUrlFromKey(deriveThumbnailKey((session as any).profilePicture))
        : null,
    },
  };
});

export const useCreateCheckoutSession = routeAction$(
  async (data, event) => {
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

    const parsedItems = JSON.parse(data.items as string) as CheckoutItemInput[];
    const items = parsedItems
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
        participantUnits: item.participantUnits ?? [],
      }))
      .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (items.length === 0) {
      return event.fail(400, { message: "Please select at least one ticket" });
    }

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

    for (const entry of products) {
      if (!entry.product) {
        return event.fail(400, { message: `Product ${entry.productId} not found` });
      }

      const expectedCapacity = Math.max(1, entry.product.participantCapacity || 1);
      if (!Array.isArray(entry.participantUnits) || entry.participantUnits.length !== entry.quantity) {
        return event.fail(400, {
          message: `Participant data is incomplete for ${entry.product.name}`,
        });
      }

      for (let unitIdx = 0; unitIdx < entry.participantUnits.length; unitIdx++) {
        const unit = entry.participantUnits[unitIdx] || [];
        if (unit.length !== expectedCapacity) {
          return event.fail(400, {
            message: `${entry.product.name} requires ${expectedCapacity} participant(s) per ticket`,
          });
        }

        for (let slotIdx = 0; slotIdx < unit.length; slotIdx++) {
          const slot = unit[slotIdx];
          const name = (slot?.name || "").trim();
          const email = (slot?.email || "").trim();
          if (!name || !email || !isValidEmail(email)) {
            return event.fail(400, {
              message: `Invalid participant details for ${entry.product.name}, ticket ${unitIdx + 1}`,
            });
          }
        }
      }
    }

    // First purchased ticket is always assigned to the buyer in slot 1.
    let firstTicketBound = false;
    const normalizedItems = products.map((entry) => {
      const normalizedUnits = entry.participantUnits.map((unit: ParticipantSlotInput[]) =>
        unit.map((slot: ParticipantSlotInput) => ({
          name: (slot?.name || "").trim(),
          email: (slot?.email || "").trim().toLowerCase(),
          existingUserId: slot?.existingUserId || null,
        })),
      );

      for (let i = 0; i < normalizedUnits.length; i++) {
        if (firstTicketBound) break;
        if (normalizedUnits[i] && normalizedUnits[i][0]) {
          normalizedUnits[i][0] = {
            ...normalizedUnits[i][0],
            name: [user.name, user.familyName].filter(Boolean).join(" ").trim() || normalizedUnits[i][0].name,
            email: (user.email || "").trim().toLowerCase() || normalizedUnits[i][0].email,
            existingUserId: user.id,
          };
          firstTicketBound = true;
        }
      }

      return {
        productId: entry.productId,
        quantity: entry.quantity,
        product: entry.product,
        participantUnits: normalizedUnits,
      };
    });

    // Calculate total amount
    const totalAmount = normalizedItems.reduce((sum, p) => {
      return sum + p.product.price * p.quantity * 100; // Convert to cents
    }, 0);

    // Handle free tickets - skip payment
    if (totalAmount === 0) {
      const { ticketsService } = await import("~/services/tickets.service");
      const { participantsService } = await import("~/services/participants.service");

      const createdTickets: any[] = [];
      for (const item of normalizedItems) {
        for (let i = 0; i < item.quantity; i++) {
          const ticket = await ticketsService.createFreeTicket({
            productId: item.productId,
            eventId,
            buyerId: user.id,
          });

          const participantSlots = item.participantUnits?.[i] || [];
          if (participantSlots.length > 0) {
            await participantsService.createBulk(
              participantSlots.map((slot: ParticipantSlotInput, slotIdx: number) => ({
                ticketId: ticket.id,
                participantOrder: slotIdx + 1,
                name: slot.name,
                email: slot.email,
                additionalData: slot.existingUserId
                  ? { existingUserId: slot.existingUserId }
                  : undefined,
              })),
            );
          }

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
    const lineItems = normalizedItems.map((p) => ({
        price_data: {
          currency: "eur",
          product_data: {
            name: p.product.name,
            description: p.product.features?.join(", ") || "",
            images: p.product.imageKey ? [publicImageUrlFromKey(p.product.imageKey)].filter(Boolean) : [],
          },
          unit_amount: Math.round(p.product.price * 100), // Convert to cents
        },
        quantity: p.quantity,
      }));

    const participantPayload = JSON.stringify(
      normalizedItems.map((item) => ({
        productId: item.productId,
        participantUnits: item.participantUnits,
      })),
    );
    const participantChunks = splitIntoChunks(participantPayload);

    const metadata: Record<string, string> = {
      eventId,
      userId: user.id,
      items: JSON.stringify(
        normalizedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      ),
      participantsChunkCount: String(participantChunks.length),
    };

    participantChunks.forEach((chunk, idx) => {
      metadata[`participantsChunk${idx}`] = chunk;
    });

    // Create Payment Intent directly
    const paymentIntent = await stripeService.stripe.paymentIntents.create({
      amount: Math.round(totalAmount),
      currency: "eur",
      metadata,
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

  const currentStep = useSignal<1 | 2 | 3 | 4>(1);
  const selectedProducts = useSignal<Record<string, number>>({});
  const participantAssignments = useSignal<ParticipantAssignmentUnit[]>([]);
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

  const canProceedFromProducts = useComputed$(() => {
    return Object.values(selectedProducts.value).some((quantity) => quantity > 0);
  });

  const totalTickets = useComputed$(() => {
    return Object.values(selectedProducts.value).reduce((sum, value) => sum + value, 0);
  });

  const participantAssignmentsByProduct = useComputed$(() => {
    const grouped = new Map<string, GroupedAssignments>();

    for (const unit of participantAssignments.value) {
      const existing = grouped.get(unit.productId);
      if (existing) {
        existing.units.push(unit);
      } else {
        grouped.set(unit.productId, {
          productId: unit.productId,
          productName: unit.productName,
          units: [unit],
        });
      }
    }

    return Array.from(grouped.values());
  });

  const handleSelectionChange = $((next: Record<string, number>) => {
    selectedProducts.value = next;
  });

  const handleStartParticipants = $((units: ParticipantAssignmentUnit[]) => {
    participantAssignments.value = units;
    currentStep.value = 2;
    paymentError.value = "";
  });

  const handleAssignmentsChange = $((next: ParticipantAssignmentUnit[]) => {
    participantAssignments.value = next;
  });

  const handleBackToProducts = $(() => {
    currentStep.value = 1;
    paymentError.value = "";
  });

  const handleContinueToPayment = $(() => {
    const error = validateParticipantSlots(participantAssignments.value);
    if (error) {
      paymentError.value = error;
      return;
    }
    paymentError.value = "";
    currentStep.value = 3;
  });

  // Load Stripe.js and create checkout session when reaching payment step.
  useVisibleTask$(async ({ track }) => {
    track(() => currentStep.value);

    if (currentStep.value === 3 && !stripeLoaded.value) {
      const participantByProduct = participantAssignments.value.reduce(
        (acc, unit) => {
          if (!acc[unit.productId]) {
            acc[unit.productId] = [];
          }
          acc[unit.productId].push(
            unit.slots
              .filter((slot) => slot.name.trim() || slot.email.trim())
              .map((slot) => ({
                name: slot.name,
                email: slot.email,
                existingUserId: slot.existingUserId || null,
              })),
          );
          return acc;
        },
        {} as Record<string, ParticipantSlotInput[][]>,
      );

      const items = Object.entries(selectedProducts.value)
        .map(([productId, quantity]) => ({
          productId,
          quantity,
          participantUnits: participantByProduct[productId] || [],
        }))
        .filter((item) => item.quantity > 0);

      const result = await createCheckoutSession.submit({
        items: JSON.stringify(items),
      });

      if (result.value?.failed) {
        paymentError.value = result.value.message || "Failed to prepare checkout";
        return;
      }

      // Handle free tickets
      if (result.value?.tickets) {
        currentStep.value = 4;
        return;
      }

      // Handle paid tickets - load Stripe
      if (result.value?.clientSecret && result.value?.paymentIntentId) {
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

    if (!(window as any).__stripeCheckout) {
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
        paymentError.value = error.message || "Payment failed";
        isProcessing.value = false;
        return;
      }

      isProcessing.value = false;
    } catch (error: any) {
      paymentError.value = "An unexpected error occurred";
      isProcessing.value = false;
    }
  });

  // Poll for payment completion
  useVisibleTask$(({ track, cleanup }) => {
    track(() => paymentIntentId.value);
    track(() => currentStep.value);

    if (currentStep.value === 3 && paymentIntentId.value) {

      const pollInterval = setInterval(async () => {
        const result = await checkPaymentStatus.submit({
          payment_intent_id: paymentIntentId.value,
        });

        if (result.value?.succeeded) {
          clearInterval(pollInterval);
          currentStep.value = 4;
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

      <StepIndicator currentStep={currentStep.value} />

      {/* Step 1: Product Selection */}
      {currentStep.value === 1 && (
        <ProductSelectionStep
          groups={data.value.groups as any[]}
          selectedProducts={selectedProducts.value}
          selectedProductDetails={selectedProductDetails.value as any[]}
          canProceedFromProducts={canProceedFromProducts.value}
          totalTickets={totalTickets.value}
          total={calculateTotal.value}
          buyer={{
            id: data.value.buyer.id,
            name: data.value.buyer.name || "",
            email: data.value.buyer.email || "",
          }}
          onSelectionChange$={handleSelectionChange}
          onContinue$={handleStartParticipants}
        />
      )}

      {/* Step 2: Participant Assignment */}
      {currentStep.value === 2 && (
        <ParticipantAssignmentStep
          groupedAssignments={participantAssignmentsByProduct.value}
          assignments={participantAssignments.value}
          buyer={{
            name: data.value.buyer.name || "",
            avatarUrl: data.value.buyer.avatarUrl,
          }}
          error={paymentError.value || undefined}
          onBack$={handleBackToProducts}
          onContinue$={handleContinueToPayment}
          onAssignmentsChange$={handleAssignmentsChange}
        />
      )}

      {/* Step 3: Payment */}
      {currentStep.value === 3 && (
        <div class="space-y-6">
          {/* Order Summary */}
          <div class="border rounded-lg p-6 bg-white">
            <h2 class="text-xl font-bold mb-4">Order Summary</h2>
            <div class="space-y-3">
              {selectedProductDetails.value.map((item: any) => (
                <div key={item.id} class="flex justify-between items-center">
                  <div>
                    <p class="font-medium">{item.name}</p>
                    <p class="text-sm text-gray-600">Quantity: {item.quantity}</p>
                  </div>
                  <p class="font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
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
              onComplete$={$(() => {
                foodConsentReady.value = true;
              })}
            />
          )}

          {data.value.photoConsentGiven === null && (
            <PhotoConsentStep
              initialValue={null}
              updateAction={savePhoto}
              onComplete$={$(() => {
                photoConsentReady.value = true;
              })}
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
                    currentStep.value = 2;
                    clientSecret.value = "";
                    paymentIntentId.value = "";
                    checkoutMounted.value = false;
                    stripeLoaded.value = false;
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

      {/* Step 4: Success */}
      {currentStep.value === 4 && (
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
