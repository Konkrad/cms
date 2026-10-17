import { createElement } from "react";
import {
	adminUrl,
	defineNotification,
	formatCurrency,
	formatDate,
	getScope,
	itemUrl,
	t,
} from "~/core";
import NoticeEmail from "~theme/emails/Notice";
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
		label: t("events.notifications.ticketConfirmation.label"),
		channels: ["email"],
		optional: false,
		render: {
			async email(data, ctx) {
				const event = await eventsService.getById(data.eventId);
				if (!event) throw new Error(`Event ${data.eventId} not found`);
				// Read at send time: the QR links show the ticket's current uuid.
				const tickets = await ticketsService.getQrCodeRefsByIds(data.ticketIds);
				return {
					subject: t("events.notifications.ticketConfirmation.subject", {
						title: event.title,
					}),
					react: createElement(TicketConfirmationEmail, {
						baseUrl: ctx.appUrl,
						event: {
							title: event.title,
							date: formatDate(event.startDate, "dateTime"),
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
	label: t("events.notifications.sale.label"),
	channels: ["telegram"],
	optional: false,
	render: {
		telegram: (data) =>
			`${t("events.notifications.sale.line", {
				quantity: data.quantity,
				product: data.productName,
				amount: formatCurrency(data.amount, "EUR"),
			})}\n${t("events.notifications.sale.remaining", { count: data.remaining })}`,
	},
});

/** Where an organiser fills in, and reviewers read, an event's debrief: its admin Review tab. */
async function eventReviewTab(event: { id: string; scopeId: string }) {
	const scope = await getScope(event.scopeId);
	return scope ? adminUrl(scope.path, `events/${event.id}/review`) : "/admin";
}

/** Asks the organiser of an event that ended for its debrief (once, plus one reminder). */
export const debriefRequestedNotification = defineNotification<{
	eventId: string;
	reminder: boolean;
}>({
	id: "events.debrief-requested",
	label: t("events.notifications.debriefRequested.label"),
	channels: ["email"],
	optional: false,
	render: {
		async email(data, ctx) {
			const event = await eventsService.getById(data.eventId);
			if (!event) throw new Error(`Event ${data.eventId} not found`);
			return {
				subject: data.reminder
					? t("events.notifications.debriefRequested.reminderSubject", {
							title: event.title,
						})
					: t("events.notifications.debriefRequested.subject", {
							title: event.title,
						}),
				react: createElement(NoticeEmail, {
					baseUrl: ctx.appUrl,
					recipientName:
						ctx.recipient.name ?? t("events.notifications.fallbackName"),
					title: data.reminder
						? t("events.notifications.debriefRequested.reminderTitle")
						: t("events.notifications.debriefRequested.title"),
					subtitle: event.title,
					paragraphs: [
						data.reminder
							? t("events.notifications.debriefRequested.reminderBody", {
									title: event.title,
								})
							: t("events.notifications.debriefRequested.body", {
									title: event.title,
								}),
					],
					quote: null,
					buttonLabel: t("events.notifications.debriefRequested.button"),
					buttonUrl: new URL(
						await eventReviewTab(event),
						ctx.appUrl,
					).toString(),
					unsubscribeUrl: ctx.unsubscribeUrl,
				}),
			};
		},
	},
});

/** Tells the event's reviewing coordinator that its debrief was filled in. */
export const debriefSubmittedNotification = defineNotification<{
	eventId: string;
}>({
	id: "events.debrief-submitted",
	label: t("events.notifications.debriefSubmitted.label"),
	channels: ["email"],
	optional: false,
	render: {
		async email(data, ctx) {
			const event = await eventsService.getById(data.eventId);
			if (!event) throw new Error(`Event ${data.eventId} not found`);
			return {
				subject: t("events.notifications.debriefSubmitted.subject", {
					title: event.title,
				}),
				react: createElement(NoticeEmail, {
					baseUrl: ctx.appUrl,
					recipientName:
						ctx.recipient.name ?? t("events.notifications.fallbackName"),
					title: t("events.notifications.debriefSubmitted.title"),
					subtitle: event.title,
					paragraphs: [
						t("events.notifications.debriefSubmitted.body", {
							title: event.title,
						}),
					],
					quote: null,
					buttonLabel: t("events.notifications.debriefSubmitted.button"),
					buttonUrl: new URL(
						await eventReviewTab(event),
						ctx.appUrl,
					).toString(),
					unsubscribeUrl: ctx.unsubscribeUrl,
				}),
			};
		},
	},
});
