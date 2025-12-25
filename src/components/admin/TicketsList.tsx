import { component$, $ } from "@builder.io/qwik";
import type { ActionStore } from "@builder.io/qwik-city";
import type { Ticket } from "~/db/schemas/tickets";
import type { users, products } from "~/db/schema";

interface TicketWithRelations extends Ticket {
  buyer: typeof users.$inferSelect;
  product: typeof products.$inferSelect;
}

interface TicketsListProps {
  tickets: TicketWithRelations[];
  scanAction: ActionStore<any, any, true>;
}

export default component$<TicketsListProps>(({ tickets, scanAction }) => {
  const scannedTickets = tickets.filter((t) => t.scannedAt);
  const unscannedTickets = tickets.filter((t) => !t.scannedAt);

  const handleManualScan = $(async (qrCodeUuid: string) => {
    await scanAction.submit({ qrCodeUuid });
  });

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div class="bg-white rounded-lg shadow-md p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-semibold">All Tickets</h3>
        <div class="text-sm text-gray-600">
          <span class="font-medium text-green-600">{scannedTickets.length}</span> scanned / 
          <span class="font-medium"> {tickets.length}</span> total
        </div>
      </div>

      <div class="space-y-6">
        {unscannedTickets.length > 0 && (
          <div>
            <h4 class="text-lg font-medium mb-3 text-gray-700">
              Pending ({unscannedTickets.length})
            </h4>
            <div class="space-y-2">
              {unscannedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">
                      {ticket.buyer.name} {ticket.buyer.familyName}
                    </p>
                    <p class="text-sm text-gray-600">{ticket.product.name}</p>
                    <p class="text-xs text-gray-500 mt-1">
                      Purchased: {formatDateTime(ticket.createdAt)}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Not Scanned
                    </span>
                    <button
                      type="button"
                      onClick$={() => handleManualScan(ticket.qrCodeUuid)}
                      disabled={scanAction.isRunning}
                      class="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Manual Scan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {scannedTickets.length > 0 && (
          <div>
            <h4 class="text-lg font-medium mb-3 text-gray-700">
              Scanned ({scannedTickets.length})
            </h4>
            <div class="space-y-2">
              {scannedTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  class="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-lg"
                >
                  <div class="flex-1">
                    <p class="font-medium text-gray-900">
                      {ticket.buyer.name} {ticket.buyer.familyName}
                    </p>
                    <p class="text-sm text-gray-600">{ticket.product.name}</p>
                    <p class="text-xs text-gray-500 mt-1">
                      Scanned: {formatDateTime(ticket.scannedAt)}
                    </p>
                  </div>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✓ Scanned
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tickets.length === 0 && (
          <p class="text-gray-500 text-center py-8">
            No tickets have been purchased yet
          </p>
        )}
      </div>
    </div>
  );
});
