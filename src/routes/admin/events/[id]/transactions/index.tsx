import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

export const useTransactions = routeLoader$(async (event) => {
  const eventId = event.params.id;
  // TODO: Load transactions for this event
  return { eventId, transactions: [] };
});

export default component$(() => {
  return (
    <div>
      <h2 class="text-2xl font-bold mb-4">Transactions</h2>
      <p class="text-gray-600">Transaction history will appear here.</p>
    </div>
  );
});
