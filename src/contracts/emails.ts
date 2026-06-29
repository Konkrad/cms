/**
 * Core → theme data contracts for email templates.
 *
 * `email-notifications.service.ts` constructs these shapes and renders them
 * against `~theme/emails/*`. Theme imports the types from here instead of
 * owning them, same boundary as route `*View` contracts.
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
