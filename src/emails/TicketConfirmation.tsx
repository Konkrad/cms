/** @jsxImportSource react */
import React from "react";
import { Text, Section, Heading, Hr } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import TicketLinksSection from "./components/TicketLinksSection";
import TransactionProductsSummary from "./components/TransactionProductsSummary";

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
    products: {
      name: string;
      amount: number;
      quantity: number;
    }[];
    totalAmount: number;
    transactionFee: number;
  };
  hasTickets: boolean;
  ticketIds: string[];
}

const TicketConfirmationEmail = ({
  baseUrl,
  event,
  transaction,
  hasTickets,
  ticketIds,
}: TicketConfirmationEmailProps) => {
  return (
    <EmailLayout
      title={event.title}
      subtitle="Purchase Confirmation & Tickets"
      baseUrl={baseUrl}
    >
      {/* Success Message */}
      <Section
        style={{
          textAlign: "center",
          padding: "20px",
          backgroundColor: "#d1fae5",
          borderRadius: "8px",
          marginBottom: "24px",
        }}
      >
        <Text
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "#065f46",
            marginBottom: "8px",
          }}
        >
          ✓ Purchase Confirmed
        </Text>
        <Text style={{ fontSize: "16px", color: "#047857", margin: "0" }}>
          Thank you for your purchase!
        </Text>
      </Section>

      {/* Greeting */}
      <Text
        style={{ fontSize: "18px", marginBottom: "16px", color: "#1f2937" }}
      >
        Hello {transaction.buyerName}!
      </Text>
      <Text style={{ color: "#4b5563", marginBottom: "24px" }}>
        Your purchase for <strong>{event.title}</strong> has been confirmed.
        {hasTickets && " Your tickets are ready below."}
      </Text>

      {/* Event Details */}
      <Section
        style={{
          marginBottom: "24px",
          padding: "16px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
        }}
      >
        <Heading
          as="h2"
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            color: "#1f2937",
            marginBottom: "12px",
            marginTop: "0",
          }}
        >
          Event Details
        </Heading>
        <Text style={{ color: "#4b5563", marginBottom: "8px" }}>
          <strong>Event:</strong> {event.title}
        </Text>
        <Text style={{ color: "#4b5563", marginBottom: "8px" }}>
          <strong>Date:</strong> {event.date}
        </Text>
        {event.location && (
          <Text style={{ color: "#4b5563", marginBottom: "0" }}>
            <strong>Location:</strong> {event.location}
          </Text>
        )}
      </Section>

      {/* Purchase Summary */}
      <TransactionProductsSummary
        products={transaction.products}
        totalAmount={transaction.totalAmount}
        transactionFee={transaction.transactionFee}
      />

      {/* Tickets Section */}
      {hasTickets && (
        <>
          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />
          <TicketLinksSection
            ticketIds={ticketIds}
            baseUrl={baseUrl}
            heading="Your Tickets"
            description="Please save these ticket QR codes. You'll need to present them at the event:"
            ticketLabelPrefix="Ticket"
          />
        </>
      )}

      <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

      {/* Instructions */}
      <Section style={{ marginBottom: "24px" }}>
        <Heading
          as="h3"
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#1f2937",
            marginBottom: "12px",
            marginTop: "0",
          }}
        >
          What's Next?
        </Heading>
        <ul style={{ paddingLeft: "20px", margin: "0" }}>
          {hasTickets && (
            <>
              <li
                style={{
                  fontSize: "14px",
                  color: "#4b5563",
                  lineHeight: "1.6",
                  marginBottom: "8px",
                }}
              >
                <strong>Save your tickets:</strong> Download or screenshot the
                QR codes above
              </li>
              <li
                style={{
                  fontSize: "14px",
                  color: "#4b5563",
                  lineHeight: "1.6",
                  marginBottom: "8px",
                }}
              >
                <strong>At the event:</strong> Present your QR code at the
                entrance for scanning
              </li>
            </>
          )}
          <li
            style={{
              fontSize: "14px",
              color: "#4b5563",
              lineHeight: "1.6",
              marginBottom: "0",
            }}
          >
            <strong>Need help?</strong> Contact support with your transaction
            ID:{" "}
            <code
              style={{
                backgroundColor: "#f3f4f6",
                padding: "2px 6px",
                borderRadius: "4px",
                fontFamily: "monospace",
                fontSize: "13px",
              }}
            >
              {transaction.transactionId}
            </code>
          </li>
        </ul>
      </Section>

      {/* Footer Note */}
      <Text
        style={{
          color: "#6b7280",
          fontSize: "14px",
          lineHeight: "1.5",
          marginBottom: "0",
        }}
      >
        This is a confirmation of your purchase. Please keep this email for your
        records.
      </Text>
    </EmailLayout>
  );
};

TicketConfirmationEmail.PreviewProps = {
  baseUrl: "http://localhost:3000",
  event: {
    title: "Tech Conference 2024",
    date: "Saturday, March 15, 2024 at 9:00 AM",
    location: "Convention Center, Main Hall, Berlin",
  },
  transaction: {
    buyerName: "John Doe",
    transactionId: "TXN-123456789",
    products: [
      { name: "General Admission", amount: 89.0, quantity: 2 },
      { name: "VIP Pass", amount: 199.0, quantity: 1 },
    ],
    totalAmount: 377.0,
    transactionFee: 12.5,
  },
  hasTickets: true,
  ticketIds: [
    "ticket-uuid-001-abc123",
    "ticket-uuid-002-def456",
    "ticket-uuid-003-ghi789",
  ],
} as TicketConfirmationEmailProps;

export default TicketConfirmationEmail;
