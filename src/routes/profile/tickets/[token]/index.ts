import type { RequestHandler } from "@qwik.dev/router";
import sharp from "sharp";
import { qrcodeService } from "~/services/qrcode.service";
import { ticketsService } from "~/services/tickets.service";

async function generateInvalidImage(): Promise<Buffer> {
  const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="#fef2f2" rx="12"/>
    <text x="200" y="165" font-family="sans-serif" font-size="48" text-anchor="middle" fill="#dc2626">&#x2715;</text>
    <text x="200" y="220" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle" fill="#dc2626">Ticket no longer valid</text>
    <text x="200" y="255" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#6b7280">This ticket has been reassigned</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const onGet: RequestHandler = async ({ params, send, headers }) => {
  const [ticketId, qrId] = params.token.split("_");

  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "no-store");

  if (!ticketId || !qrId) {
    send(200, await generateInvalidImage());
    return;
  }

  const ticket = await ticketsService.getById(ticketId);

  if (!ticket || ticket.qrCodeUuid !== qrId) {
    send(200, await generateInvalidImage());
    return;
  }

  send(200, await qrcodeService.generateQRCode(ticket.qrCodeUuid));
};
