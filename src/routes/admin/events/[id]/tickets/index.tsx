import { component$ } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";

export const useTickets = routeLoader$(async (event) => {
  const eventId = event.params.id;
  // TODO: Load tickets for this event
  return { eventId, tickets: [] };
});

export default component$(() => {
  return (
    <div>
      <h2 class="text-2xl font-bold mb-4">Tickets & Scanning</h2>
      <p class="text-gray-600">Ticket scanning interface will appear here.</p>
    </div>
  );
});
