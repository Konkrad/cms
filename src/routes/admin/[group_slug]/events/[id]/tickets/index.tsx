import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, z } from "@builder.io/qwik-city";
import { ticketsService } from "~/services/tickets.service";
import TicketScanner from "~/components/admin/TicketScanner";
import TicketsList from "~/components/admin/TicketsList";

export const useTickets = routeLoader$(async (event) => {
  const eventId = event.params.id;
  const tickets = await ticketsService.getByEventId(eventId);
  return { eventId, tickets };
});

export const useScanTicket = routeAction$(
  async (data, { params }) => {
    const { qrCodeUuid } = data;

    console.log("=== SCAN TICKET DEBUG ===");
    console.log("QR Code UUID:", qrCodeUuid);
    console.log("Event ID:", params.id);

    const ticket = await ticketsService.getByQrCodeUuid(qrCodeUuid);

    if (!ticket) {
      console.error("Ticket not found for QR code:", qrCodeUuid);
      return {
        success: false,
        error: "Ticket not found",
        details: `No ticket found with QR code: ${qrCodeUuid}`,
      };
    }

    console.log("Ticket found:", {
      ticketId: ticket.id,
      eventId: ticket.eventId,
      scannedAt: ticket.scannedAt,
      buyer: `${ticket.buyer.name} ${ticket.buyer.familyName}`,
    });

    if (ticket.eventId !== params.id) {
      console.error("Event mismatch:", {
        ticketEventId: ticket.eventId,
        requestedEventId: params.id,
      });
      return {
        success: false,
        error: "This ticket is not for this event",
        details: `Ticket is for event ${ticket.eventId}, but you're scanning for event ${params.id}`,
      };
    }

    if (ticket.scannedAt) {
      console.warn("Ticket already scanned:", {
        ticketId: ticket.id,
        scannedAt: ticket.scannedAt,
      });
      return {
        success: false,
        error: "This ticket was already scanned",
        alreadyScanned: true,
        scannedAt: ticket.scannedAt,
        details: `Scanned at: ${new Date(ticket.scannedAt).toLocaleString()}`,
      };
    }

    console.log("Attempting to scan ticket...");
    const scanRes = await ticketsService.scanTicket(qrCodeUuid, params.id);

    if (!scanRes.success) {
      console.error("scanTicket returned failure - checking current state");

      const latest = await ticketsService.getByQrCodeUuid(qrCodeUuid);
      console.log("Latest ticket state:", {
        found: !!latest,
        scannedAt: latest?.scannedAt,
      });

      if (latest?.scannedAt) {
        console.warn("Ticket was scanned by another scanner");
        return {
          success: false,
          error: "This ticket was already scanned (race condition)",
          alreadyScanned: true,
          scannedAt: latest.scannedAt,
          details: `Scanned at: ${new Date(latest.scannedAt).toLocaleString()}`,
        };
      }

      // Retry once (in case of transient DB glitch)
      console.log("Retrying scan...");
      const retryRes = await ticketsService.scanTicket(qrCodeUuid, params.id);
      if (retryRes.success) {
        console.log("Retry successful!");
        return {
          success: true,
          ticket: retryRes.ticket,
          message: `Ticket scanned successfully for ${ticket.buyer.name} ${ticket.buyer.familyName}`,
        };
      }

      console.error(
        "scanTicket failed to update and ticket remains unscanned",
        {
          ticketId: ticket.id,
          qrCodeUuid,
          ticketData: ticket,
        },
      );

      return {
        success: false,
        error: "Failed to scan ticket - database update failed",
        reason: "update-no-rows-after-retry",
        ticketId: ticket.id,
        details: `Database update failed for ticket ${ticket.id}. This might be a database constraint issue or the ticket state changed unexpectedly.`,
      };
    }

    const scannedTicket = scanRes.ticket;

    console.log("Scan successful!", {
      ticketId: scannedTicket.id,
      scannedAt: scannedTicket.scannedAt,
    });

    return {
      success: true,
      ticket: scannedTicket,
      message: `Ticket scanned successfully for ${ticket.buyer.name} ${ticket.buyer.familyName}`,
    };
  },
  zod$({
    qrCodeUuid: z.string().uuid(),
  }),
);

export default component$(() => {
  const tickets = useTickets();
  const scanAction = useScanTicket();
  const searchQuery = useSignal("");

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold mb-2">Tickets & Scanning</h2>
        <p class="text-gray-600">
          Scan QR codes or search for tickets by buyer name
        </p>
      </div>

      <TicketScanner action={scanAction} />

      <div class="bg-white rounded-lg shadow-md p-6">
        <h3 class="text-xl font-semibold mb-4">Search Tickets</h3>
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

      <TicketsList
        tickets={tickets.value.tickets}
        scanAction={scanAction}
        searchQuery={searchQuery}
      />
    </div>
  );
});
