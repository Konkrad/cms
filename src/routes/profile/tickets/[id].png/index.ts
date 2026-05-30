import type { RequestHandler } from "@qwik.dev/router";
import { ticketsService } from "~/services/tickets.service";
import { qrcodeService } from "~/services/qrcode.service";

export const onGet: RequestHandler = async ({ params, send, status, headers }) => {
  const ticketId = params.id;

  if (!ticketId) {
    status(400);
    return;
  }

  const ticket = await ticketsService.getById(ticketId);

  if (!ticket) {
    status(404);
    return;
  }

  const qrCodeBuffer = await qrcodeService.generateQRCode(ticket.qrCodeUuid);

  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "no-store");

  send(200, qrCodeBuffer);
};
