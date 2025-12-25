import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z } from "@builder.io/qwik-city";
import { ticketsService } from "~/services/tickets.service";
import TicketScanner from "~/components/admin/TicketScanner";
import TicketSearch from "~/components/admin/TicketSearch";
import TicketsList from "~/components/admin/TicketsList";

export const useTickets = routeLoader$(async (event) => {
  const eventId = event.params.id;
  const tickets = await ticketsService.getByEventId(eventId);
  return { eventId, tickets };
});

export const useScanTicket = routeAction$(
  async (data, { params }) => {
    const { qrCodeUuid } = data;
    
    const ticket = await ticketsService.getByQrCodeUuid(qrCodeUuid);
    
    if (!ticket) {
      return {
        success: false,
        error: "Ticket not found",
      };
    }

    if (ticket.eventId !== params.id) {
      return {
        success: false,
        error: "This ticket is not for this event",
      };
    }

    if (ticket.scannedAt) {
      return {
        success: false,
        error: "This ticket was already scanned",
        alreadyScanned: true,
        scannedAt: ticket.scannedAt,
      };
    }

    const scannedTicket = await ticketsService.scanTicket(qrCodeUuid);
    
    if (!scannedTicket) {
      return {
        success: false,
        error: "Failed to scan ticket",
      };
    }

    return {
      success: true,
      ticket: scannedTicket,
      message: `Ticket scanned successfully for ${ticket.buyer.name} ${ticket.buyer.familyName}`,
    };
  },
  zod$({
    qrCodeUuid: z.string().uuid(),
  })
);

export default component$(() => {
  const tickets = useTickets();
  const scanAction = useScanTicket();

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold mb-2">Tickets & Scanning</h2>
        <p class="text-gray-600">
          Scan QR codes or search for tickets by buyer name
        </p>
      </div>

      <TicketScanner action={scanAction} />

      <TicketSearch tickets={tickets.value.tickets} />

      <TicketsList tickets={tickets.value.tickets} scanAction={scanAction} />
    </div>
  );
});
