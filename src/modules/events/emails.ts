import { createElement } from "react";
import { defineNotification, itemUrl } from "~/core";
import TicketConfirmationEmail from "~theme/emails/TicketConfirmation";
import { eventsService } from "./services/events";
import { icalService } from "./services/ical";
import { ticketsService } from "./services/tickets";

/**
 * Notifications of the events module (declared in the manifest, sent with `notify(id, ...)`).
 * Renderers run in the outbox worker; they load the event and tickets by the ids in `data`.
 */

export interface TicketConfirmationData extends Record<string, unknown> {
	eventId: string;
	/** Shown as the order reference (the ticket id for a free RSVP without transaction). */
	transactionId: string;
	products: { name: string; quantity: number; amount: number }[];
	totalAmount: number;
	ticketIds: string[];
}

/** Ticket confirmation to the buyer (paid purchase or free RSVP). Required. */
export const ticketConfirmationNotification =
	defineNotification<TicketConfirmationData>({
		id: "events.ticket-confirmation",
		label: "Ticket confirmation",
		channels: ["email"],
		optional: false,
		render: {
			async email(data, ctx) {
				const event = await eventsService.getById(data.eventId);
				if (!event) throw new Error(`Event ${data.eventId} not found`);
				// Read at send time: the QR links show the ticket's current uuid.
				const tickets = await ticketsService.getQrCodeRefsByIds(data.ticketIds);
				return {
					subject: `Your tickets for ${event.title}`,
					react: createElement(TicketConfirmationEmail, {
						baseUrl: ctx.appUrl,
						event: {
							title: event.title,
							date: new Date(event.startDate).toLocaleString(),
							location: event.address || event.onlineUrl || undefined,
						},
						transaction: {
							buyerName: ctx.recipient.name || ctx.recipient.address,
							transactionId: data.transactionId,
							products: data.products,
							totalAmount: data.totalAmount,
						},
						hasTickets: tickets.length > 0,
						tickets,
					}),
					// Built at send time from the event id, so the outbox stores no binary data.
					attachments: [
						{
							filename: "event.ics",
							content: icalService.generateEventIcs(
								event,
								new URL(
									await itemUrl("events:event", event),
									ctx.appUrl,
								).toString(),
							),
							contentType: "text/calendar; charset=utf-8; method=PUBLISH",
						},
					],
				};
			},
		},
	});

export interface SaleAlertData extends Record<string, unknown> {
	productName: string;
	quantity: number;
	/** Line total in euros. */
	amount: number;
	remaining: number;
}

/** "New sale" alert to the ops Telegram channel, one per purchased product. Required. */
export const saleAlertNotification = defineNotification<SaleAlertData>({
	id: "events.sale",
	label: "New ticket sale",
	channels: ["telegram"],
	optional: false,
	render: {
		telegram: (data) =>
			`🎫 New sale: ${data.quantity}x ${data.productName} (€${data.amount.toFixed(2)})\n` +
			`📊 Remaining: ${data.remaining} spots`,
	},
});
