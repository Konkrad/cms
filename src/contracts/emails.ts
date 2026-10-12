/**
 * Core → theme data contracts for email templates.
 *
 * `email-notifications.service.ts` (login) and the notification renderers of modules
 * (`src/modules/events/emails.ts`, `src/modules/jobs/notifications.ts`) construct these shapes and
 * render them against `~theme/emails/*`. Theme imports
 * the types from here instead of owning them, same boundary as route `*View` contracts.
 */

export interface LoginEmailProps {
	link: string;
	code: string;
	appName?: string;
	baseUrl: string;
	expiresInMinutes?: number;
}

export interface TicketConfirmationEmailProps {
	baseUrl: string;
	event: {
		title: string;
		date: string;
		location?: string;
	};
	transaction: {
		buyerName: string;
		transactionId: string;
		products: { name: string; quantity: number; amount: number }[];
		totalAmount: number;
	};
	hasTickets: boolean;
	tickets: { id: string; qrCodeUuid: string }[];
}

/** Sent to the poster when an admin approves their job (optional notification). */
export interface JobApprovedEmailProps {
	baseUrl: string;
	recipientName: string;
	jobTitle: string;
	jobUrl: string;
	unsubscribeUrl: string | null;
}

/**
 * A short notice with one call to action (review requested or decided, debrief requested):
 * plain text paragraphs (never HTML), an optional quoted comment and a button.
 */
export interface NoticeEmailProps {
	baseUrl: string;
	recipientName: string;
	title: string;
	subtitle: string;
	paragraphs: string[];
	/** Quoted as written, e.g. a reviewer's comment. */
	quote: string | null;
	buttonLabel: string;
	buttonUrl: string;
	unsubscribeUrl: string | null;
}
