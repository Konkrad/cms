/** @jsxImportSource react */
import { Img, Section, Text } from "@react-email/components";
import type * as React from "react";

export interface Ticket {
  id: string;
  qrCodeUuid: string;
  productName: string;
}

export interface TicketLinksSectionProps {
  tickets: Ticket[];
  baseUrl: string;
}

export default function TicketLinksSection({
  tickets,
  baseUrl,
}: TicketLinksSectionProps) {
  if (tickets.length === 0) {
    return null;
  }

  return (
    <Section style={sectionStyle}>
      <Text style={headingStyle}>Your Tickets</Text>
      <Text style={descriptionStyle}>
        Present these QR codes at the event entrance for entry:
      </Text>
      {tickets.map((ticket, index) => (
        <div key={ticket.id} style={ticketContainerStyle}>
          <Text style={ticketLabelStyle}>
            Ticket {index + 1}: {ticket.productName}
          </Text>
          <Img
            src={`${baseUrl}/profile/tickets/${ticket.id}.png`}
            alt={`QR Code for ${ticket.productName}`}
            width="200"
            height="200"
            style={qrCodeStyle}
          />
          <Text style={uuidStyle}>Ticket ID: {ticket.qrCodeUuid}</Text>
        </div>
      ))}
    </Section>
  );
}

const sectionStyle: React.CSSProperties = {
  marginTop: "24px",
  marginBottom: "24px",
};

const headingStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  marginBottom: "12px",
};

const descriptionStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#666",
  marginBottom: "16px",
};

const ticketContainerStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "16px",
  textAlign: "center",
};

const ticketLabelStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  marginBottom: "12px",
};

const qrCodeStyle: React.CSSProperties = {
  display: "block",
  margin: "0 auto",
  border: "2px solid #000",
  borderRadius: "4px",
};

const uuidStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  marginTop: "8px",
  fontFamily: "monospace",
};
