/** @jsxImportSource react */
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";
import TicketLinksSection from "./components/TicketLinksSection";
import TransactionProductsSummary from "./components/TransactionProductsSummary";

export interface TicketConfirmationEmailProps {
  eventTitle: string;
  eventDate: string;
  eventLocation?: string;
  buyerName: string;
  transactionId: string;
  products: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  tickets: Array<{
    id: string;
    qrCodeUuid: string;
    productName: string;
  }>;
  totalAmount: number;
  transactionFee: number;
  baseUrl: string;
}

export default function TicketConfirmationEmail({
  eventTitle,
  eventDate,
  eventLocation,
  buyerName,
  transactionId,
  products,
  tickets,
  totalAmount,
  transactionFee,
  baseUrl,
}: TicketConfirmationEmailProps) {
  const hasTickets = tickets.length > 0;

  return (
    <Html>
      <Head />
      <Preview>Your tickets for {eventTitle}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={titleStyle}>✓ Purchase Confirmed</Text>
            <Text style={subtitleStyle}>Thank you for your purchase!</Text>
          </Section>

          {/* Event Details */}
          <Section style={eventDetailsStyle}>
            <Text style={eventTitleStyle}>{eventTitle}</Text>
            <Text style={eventInfoStyle}>📅 {eventDate}</Text>
            {eventLocation && (
              <Text style={eventInfoStyle}>📍 {eventLocation}</Text>
            )}
          </Section>

          <Hr style={hrStyle} />

          {/* Greeting */}
          <Section>
            <Text style={greetingStyle}>Hi {buyerName},</Text>
            <Text style={bodyTextStyle}>
              Your purchase for <strong>{eventTitle}</strong> has been confirmed. 
              {hasTickets && " Your tickets are attached below."}
            </Text>
          </Section>

          {/* Transaction Summary */}
          <TransactionProductsSummary
            products={products}
            totalAmount={totalAmount}
            transactionFee={transactionFee}
          />

          {/* Tickets Section */}
          {hasTickets && (
            <>
              <Hr style={hrStyle} />
              <TicketLinksSection tickets={tickets} baseUrl={baseUrl} />
            </>
          )}

          <Hr style={hrStyle} />

          {/* Instructions */}
          <Section style={instructionsStyle}>
            <Text style={instructionsTitleStyle}>What's Next?</Text>
            <ul style={listStyle}>
              {hasTickets && (
                <>
                  <li style={listItemStyle}>
                    <strong>Save your tickets:</strong> Download the attached QR codes or 
                    access them anytime in your account
                  </li>
                  <li style={listItemStyle}>
                    <strong>Add to calendar:</strong> Import the attached .ics file to 
                    your calendar app
                  </li>
                  <li style={listItemStyle}>
                    <strong>At the event:</strong> Present your QR code at the entrance 
                    for scanning
                  </li>
                </>
              )}
              <li style={listItemStyle}>
                <strong>Need help?</strong> Contact support with your transaction ID: {" "}
                <code style={codeStyle}>{transactionId}</code>
              </li>
            </ul>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              This is a confirmation of your purchase. Please keep this email for your records.
            </Text>
            <Text style={footerTextStyle}>
              Transaction ID: {transactionId}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "20px",
  maxWidth: "600px",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0",
};

const titleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: "bold",
  color: "#10b981",
  marginBottom: "8px",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "18px",
  color: "#6b7280",
};

const eventDetailsStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  marginTop: "20px",
  marginBottom: "20px",
};

const eventTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "700",
  color: "#111827",
  marginBottom: "12px",
};

const eventInfoStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#4b5563",
  marginBottom: "4px",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#111827",
  marginBottom: "8px",
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: "16px",
  color: "#4b5563",
  lineHeight: "1.6",
  marginBottom: "16px",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const instructionsStyle: React.CSSProperties = {
  marginTop: "24px",
};

const instructionsTitleStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#111827",
  marginBottom: "16px",
};

const listStyle: React.CSSProperties = {
  paddingLeft: "20px",
  margin: "0",
};

const listItemStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  lineHeight: "1.6",
  marginBottom: "12px",
};

const codeStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  padding: "2px 6px",
  borderRadius: "4px",
  fontFamily: "monospace",
  fontSize: "13px",
};

const footerStyle: React.CSSProperties = {
  marginTop: "32px",
  paddingTop: "24px",
  borderTop: "1px solid #e5e7eb",
  textAlign: "center",
};

const footerTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  marginBottom: "4px",
};
