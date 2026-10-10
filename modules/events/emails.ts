import { render } from "@react-email/render";
import * as React from "react";
import { getAppUrl, sendEmail } from "~/core-api";
import TicketConfirmationEmail from "~theme/emails/TicketConfirmation";

/** Ticket confirmation (paid purchase or free RSVP). Server-only. */
export async function sendTicketConfirmation({
	to,
	buyerName,
	event,
	transactionId,
	products,
	totalAmount,
	tickets,
}: {
	to: string;
	buyerName: string;
	event: {
		title: string;
		startDate: string;
		address?: string | null;
		onlineUrl?: string | null;
	};
	transactionId: string;
	products: { name: string; quantity: number; amount: number }[];
	totalAmount: number;
	tickets: { id: string; qrCodeUuid: string }[];
}): Promise<void> {
	const eventDate = new Date(event.startDate).toLocaleString();
	const location = event.address || event.onlineUrl || undefined;

	const element = React.createElement(TicketConfirmationEmail, {
		baseUrl: getAppUrl(),
		event: { title: event.title, date: eventDate, location },
		transaction: { buyerName, transactionId, products, totalAmount },
		hasTickets: tickets.length > 0,
		tickets,
	});
	const [html, text] = await Promise.all([
		render(element),
		render(element, { plainText: true }),
	]);

	await sendEmail({
		to,
		subject: `Your tickets for ${event.title}`,
		html,
		text,
	});
}
