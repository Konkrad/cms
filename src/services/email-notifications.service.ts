import { render } from "@react-email/render";
import * as React from "react";
import LoginEmail from "~/emails/LoginEmail";
import TicketConfirmationEmail from "~/emails/TicketConfirmation";
import { env } from "~/env";
import { sendEmail } from "~/utils/send-email";

export const emailNotificationsService = {
  async sendLoginEmail({
    to,
    link,
    code,
    subject,
  }: {
    to: string;
    link: string;
    code: string;
    subject?: string;
  }): Promise<void> {
    const appName = env.APP_NAME;
    const element = React.createElement(LoginEmail, { link, code, appName, baseUrl: env.APP_URL });
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    await sendEmail({
      to,
      subject: subject ?? `Sign in to ${appName}`,
      html,
      text,
    });
  },

  async sendTicketConfirmation({
    to,
    buyerName,
    event,
    transactionId,
    products,
    totalAmount,
    ticketIds,
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
    ticketIds: string[];
  }): Promise<void> {
    const eventDate = new Date(event.startDate).toLocaleString();
    const location = event.address || event.onlineUrl || undefined;

    const element = React.createElement(TicketConfirmationEmail, {
      baseUrl: env.APP_URL,
      event: { title: event.title, date: eventDate, location },
      transaction: { buyerName, transactionId, products, totalAmount },
      hasTickets: ticketIds.length > 0,
      ticketIds,
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
  },
};
