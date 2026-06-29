import {
  component$,
  useSignal,
  useComputed$,
  useVisibleTask$,
  $,
} from "@qwik.dev/core";
import { Button } from "~/components/ui/Button";
import { FoodPreferenceStep } from "~theme/shared/FoodPreferenceStep/FoodPreferenceStep";
import { PhotoConsentStep } from "~theme/shared/PhotoConsentStep/PhotoConsentStep";
import { StepIndicator } from "~theme/routes/events/checkout/StepIndicator";
import { ProductSelectionStep } from "~theme/routes/events/checkout/ProductSelectionStep";
import { ParticipantAssignmentStep } from "~theme/routes/events/checkout/ParticipantAssignmentStep";
import { validateParticipantSlots } from "~/utils/participant-validation";
import type {
  GroupedAssignments,
  ParticipantAssignmentUnit,
  ParticipantSlotInput,
} from "~theme/routes/events/checkout/types";
import type {
  CheckPaymentStatusAction,
  CheckoutData,
  CreateCheckoutSessionAction,
  SaveFoodPreferenceAction,
  SavePhotoConsentAction,
} from "~/contracts/checkout";

/** Themed view for the ticket purchase / Stripe checkout flow (`/events/[id]/checkout`). */
export const CheckoutView = component$<{
  data: CheckoutData;
  createCheckoutSession: CreateCheckoutSessionAction;
  checkPaymentStatus: CheckPaymentStatusAction;
  saveFood: SaveFoodPreferenceAction;
  savePhoto: SavePhotoConsentAction;
}>(({ data: dataValue, createCheckoutSession, checkPaymentStatus, saveFood, savePhoto }) => {
  const data = dataValue;

  const currentStep = useSignal<1 | 2 | 3 | 4>(1);
  const selectedProducts = useSignal<Record<string, number>>({});
  const participantAssignments = useSignal<ParticipantAssignmentUnit[]>([]);
  const clientSecret = useSignal<string>("");
  const paymentIntentId = useSignal<string>("");
  const stripeLoaded = useSignal(false);
  const checkoutMounted = useSignal(false);
  const isProcessing = useSignal(false);
  const paymentError = useSignal<string>("");
  const foodConsentReady = useSignal(data.foodPreference !== null);
  const photoConsentReady = useSignal(data.photoConsentGiven !== null);

  const calculateTotal = useComputed$(() => {
    let total = 0;
    for (const [productId, quantity] of Object.entries(
      selectedProducts.value,
    )) {
      const product = data.groups
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
        const product = data.groups
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
      const stripe = (window as any).Stripe(data.stripePublishableKey);
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
          return_url: `${window.location.origin}/events/${data.eventId}/checkout/success`,
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
          groups={data.groups as any[]}
          selectedProducts={selectedProducts.value}
          selectedProductDetails={selectedProductDetails.value as any[]}
          canProceedFromProducts={canProceedFromProducts.value}
          totalTickets={totalTickets.value}
          total={calculateTotal.value}
          buyer={{
            id: data.buyer.id,
            name: data.buyer.name || "",
            email: data.buyer.email || "",
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
            name: data.buyer.name || "",
            avatarUrl: data.buyer.avatarUrl,
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
          {data.foodPreference === null && (
            <FoodPreferenceStep
              initialPreference={null}
              updateAction={saveFood}
              onComplete$={$(() => {
                foodConsentReady.value = true;
              })}
            />
          )}

          {data.photoConsentGiven === null && (
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
                href={`/events/${data.eventId}`}
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
