import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  z,
  zod$,
} from "@builder.io/qwik-city";
import { stripeService } from "~/services/stripe.service";
import { transactionsService } from "~/services/transactions.service";

export const useCheckoutSession = routeLoader$(async (event) => {
  const sessionId = event.query.get("session_id");
  
  if (!sessionId) {
    throw event.redirect(303, `/events/${event.params.id}/products`);
  }
  
  try {
    const session = await stripeService.getSession(sessionId);
    
    return {
      sessionId,
      status: session.status,
      paymentStatus: session.payment_status,
    };
  } catch (error) {
    console.error("Failed to retrieve checkout session:", error);
    throw event.redirect(303, `/events/${event.params.id}/products`);
  }
});

export const useCheckTransactionStatus = routeAction$(
  async (data, event) => {
    const transaction = await transactionsService.findBySessionId(data.sessionId);
    
    if (transaction) {
      return {
        completed: true,
        transactionId: transaction.id,
      };
    }
    
    return { completed: false };
  },
  zod$({
    sessionId: z.string(),
  }),
);

export default component$(() => {
  const sessionData = useCheckoutSession();
  const checkStatus = useCheckTransactionStatus();
  
  const isCompleted = useSignal(false);
  const isChecking = useSignal(true);
  const transactionId = useSignal<string | null>(null);
  
  // Poll for transaction completion
  useVisibleTask$(({ track, cleanup }) => {
    track(() => sessionData.value);
    
    const pollInterval = setInterval(async () => {
      if (isCompleted.value) {
        clearInterval(pollInterval);
        return;
      }
      
      // Check transaction status
      const formData = new FormData();
      formData.append("sessionId", sessionData.value.sessionId);
      
      try {
        const response = await fetch(window.location.pathname, {
          method: "POST",
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.completed) {
          isCompleted.value = true;
          transactionId.value = result.transactionId;
          isChecking.value = false;
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Failed to check transaction status:", error);
      }
    }, 2000); // Poll every 2 seconds
    
    // Stop checking after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      isChecking.value = false;
    }, 5 * 60 * 1000);
    
    cleanup(() => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    });
  });
  
  return (
    <div class="max-w-2xl mx-auto p-6">
      <div class="text-center">
        {isChecking.value && !isCompleted.value && (
          <div class="space-y-6">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-900 mx-auto"></div>
            <h1 class="text-2xl font-bold">Processing Your Payment</h1>
            <p class="text-gray-600">
              Please wait while we confirm your purchase. This should only take a moment.
            </p>
            <div class="p-4 bg-blue-50 border border-blue-200 rounded">
              <p class="text-sm text-blue-800">
                💡 Don't close this window. We're waiting for payment confirmation from Stripe.
              </p>
            </div>
          </div>
        )}
        
        {isCompleted.value && transactionId.value && (
          <div class="space-y-6">
            <div class="text-green-500 text-6xl mb-4">✓</div>
            <h1 class="text-3xl font-bold text-green-600">Payment Successful!</h1>
            <p class="text-gray-600 text-lg">
              Thank you for your purchase. Your tickets have been generated.
            </p>
            <div class="p-6 bg-green-50 border border-green-200 rounded">
              <h2 class="font-bold mb-2">What's Next?</h2>
              <ul class="text-left space-y-2 text-sm">
                <li>📧 Check your email for your tickets with QR codes</li>
                <li>📱 Add the event to your calendar using the attached .ics file</li>
                <li>🎫 Present your QR code at the event for entry</li>
              </ul>
            </div>
            <div class="flex gap-4 justify-center mt-6">
              <a
                href={`/profile/tickets`}
                class="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View My Tickets
              </a>
              <a
                href={`/events/${sessionData.value.sessionId.split("_")[0]}`}
                class="px-6 py-3 border border-gray-300 rounded hover:bg-gray-50"
              >
                Back to Event
              </a>
            </div>
          </div>
        )}
        
        {!isChecking.value && !isCompleted.value && (
          <div class="space-y-6">
            <div class="text-yellow-500 text-6xl mb-4">⏱️</div>
            <h1 class="text-2xl font-bold">Still Processing</h1>
            <p class="text-gray-600">
              Your payment is taking longer than expected. Don't worry - we'll send you an
              email once everything is confirmed.
            </p>
            <div class="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p class="text-sm text-yellow-800">
                If you don't receive a confirmation email within 10 minutes, please contact support.
              </p>
            </div>
            <a
              href="/profile/tickets"
              class="inline-block px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Check My Tickets
            </a>
          </div>
        )}
      </div>
    </div>
  );
});
