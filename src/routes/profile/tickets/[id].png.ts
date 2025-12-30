import type { RequestHandler } from "@builder.io/qwik-city";
import { ticketsService } from "~/services/tickets.service";
import { generateTicketQR } from "~/utils/qr-code";
import { getCurrentUserData, requireAuth } from "~/utils/server-auth";

export const onGet: RequestHandler = async (event) => {
  await requireAuth(event);
  const userData = await getCurrentUserData(event);

  if (!userData) {
    throw event.redirect(302, "/login");
  }

  const ticketId = event.params.id;
  const ticket = await ticketsService.getById(ticketId);

  if (!ticket) {
    throw event.error(404, "Ticket not found");
  }

  // Verify the ticket belongs to the current user
  if (ticket.buyerId !== userData.id) {
    throw event.error(403, "Access denied");
  }

  // Generate QR code as data URL
  const qrDataUrl = await generateTicketQR(ticket.id, ticket.eventId);

  // Extract base64 data from data URL
  const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, "base64");

  event.headers.set("Content-Type", "image/png");
  event.headers.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day

  event.send(200, imageBuffer);
};
