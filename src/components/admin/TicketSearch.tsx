import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import Fuse from "fuse.js";
import type { Ticket } from "~/db/schemas/tickets";
import type { users, products } from "~/db/schema";

interface TicketWithRelations extends Ticket {
  buyer: typeof users.$inferSelect;
  product: typeof products.$inferSelect;
}

interface TicketSearchProps {
  tickets: TicketWithRelations[];
}

export default component$<TicketSearchProps>(({ tickets }) => {
  const searchQuery = useSignal("");

  const searchResults = useComputed$(() => {
    if (!searchQuery.value.trim()) {
      return [];
    }

    const fuse = new Fuse(tickets, {
      keys: ["buyer.name", "buyer.familyName", "buyer.loginId", "product.name"],
      threshold: 0.3,
      includeScore: true,
    });

    const results = fuse.search(searchQuery.value);
    return results.map((result) => result.item);
  });

  return (
    <div class="bg-white rounded-lg shadow-md p-6">
      <h3 class="text-xl font-semibold mb-4">Search Tickets</h3>

      <div class="mb-4">
        <input
          type="text"
          value={searchQuery.value}
          onInput$={(e) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
          }}
          placeholder="Search by buyer name, email, or product..."
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {searchQuery.value.trim() && (
        <div class="space-y-2">
          {searchResults.value.length === 0 ? (
            <p class="text-gray-500 text-center py-4">No tickets found</p>
          ) : (
            <>
              <p class="text-sm text-gray-600 mb-2">
                Found {searchResults.value.length} ticket(s)
              </p>
              {searchResults.value.map((ticket) => (
                <div
                  key={ticket.id}
                  class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div class="flex-1">
                    <p class="font-medium">
                      {ticket.buyer.name} {ticket.buyer.familyName}
                    </p>
                    <p class="text-sm text-gray-600">{ticket.product.name}</p>
                    <p class="text-xs text-gray-500">{ticket.buyer.loginId}</p>
                  </div>
                  <div class="text-right">
                    {ticket.scannedAt ? (
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Scanned
                      </span>
                    ) : (
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Not Scanned
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
});
