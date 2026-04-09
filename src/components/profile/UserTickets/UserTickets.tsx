import { component$, useSignal, $ } from "@builder.io/qwik";
import type { Ticket } from "~/db/schemas/tickets";
import type { events, products } from "~/db/schema";
import { Modal } from "~/components/ui/Modal";
import { SectionCard } from "~/components/ui/SectionCard";

interface TicketWithRelations extends Ticket {
  event: typeof events.$inferSelect;
  product: typeof products.$inferSelect;
}

interface UserTicketsProps {
  tickets: TicketWithRelations[];
}

export default component$<UserTicketsProps>(({ tickets }) => {
  const selectedTicket = useSignal<TicketWithRelations | null>(null);

  const now = new Date();
  const upcomingTickets = tickets.filter(
    (t) => new Date(t.event.startDate) >= now,
  );
  const pastTickets = tickets.filter((t) => new Date(t.event.startDate) < now);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showQrCode = $((ticket: TicketWithRelations) => {
    selectedTicket.value = ticket;
  });

  const closeModal = $(() => {
    selectedTicket.value = null;
  });

  const renderTicketGroup = (tickets: TicketWithRelations[], title: string) => {
    if (tickets.length === 0) return null;

    const ticketsByEvent = tickets.reduce(
      (acc, ticket) => {
        const eventId = ticket.eventId;
        if (!acc[eventId]) {
          acc[eventId] = {
            event: ticket.event,
            tickets: [],
          };
        }
        acc[eventId].tickets.push(ticket);
        return acc;
      },
      {} as Record<
        string,
        { event: typeof events.$inferSelect; tickets: TicketWithRelations[] }
      >,
    );

    return (
      <div class="mb-8">
        <h4 class="text-lg font-semibold text-gray-700 mb-3">{title}</h4>
        <div class="space-y-4">
          {Object.values(ticketsByEvent).map(({ event, tickets }) => (
            <div key={event.id} class="border border-gray-200 rounded-lg p-4">
              <div class="mb-3">
                <h5 class="font-semibold text-gray-900">{event.title}</h5>
                <p class="text-sm text-gray-600">
                  {formatDate(event.startDate)}
                </p>
                <p class="text-sm text-gray-500">
                  {event.address || event.city || ""}
                </p>
              </div>

              <div class="space-y-2">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p class="font-medium text-gray-900">
                        {ticket.product.name}
                      </p>
                      {ticket.scannedAt && (
                        <p class="text-xs text-green-600 mt-1">
                          ✓ Scanned on {formatDate(ticket.scannedAt)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick$={() => showQrCode(ticket)}
                      class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      View QR Code
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <SectionCard title="My Tickets">
      {tickets.length === 0 ? (
        <p class="text-gray-500 text-center py-8">You don't have any tickets</p>
      ) : (
        <>
          {renderTicketGroup(
            upcomingTickets,
            `Upcoming Events (${upcomingTickets.length})`,
          )}
          {renderTicketGroup(
            pastTickets,
            `Past Events (${pastTickets.length})`,
          )}
        </>
      )}

      <Modal
        open={!!selectedTicket.value}
        onClose$={closeModal}
        title="Ticket QR Code"
        size="md"
      >
        {selectedTicket.value && (
          <div class="text-center space-y-4">
            <div class="bg-white p-4 rounded-lg">
              <img
                src={`/profile/tickets/${selectedTicket.value.id}.png`}
                alt="Ticket QR Code"
                class="w-full max-w-sm mx-auto"
              />
            </div>

            <div class="text-left">
              <p class="font-medium text-gray-900">
                {selectedTicket.value.event.title}
              </p>
              <p class="text-sm text-gray-600">
                {selectedTicket.value.product.name}
              </p>
              <p class="text-sm text-gray-500 mt-2">
                {formatDate(selectedTicket.value.event.startDate)}
              </p>
              {selectedTicket.value.scannedAt && (
                <p class="text-sm text-green-600 mt-2">✓ Already scanned</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </SectionCard>
  );
});
