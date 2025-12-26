/** @jsxImportSource react */
import { Img, Section, Text } from "@react-email/components";
import type * as React from "react";

export interface TicketLinksSectionProps {
  ticketIds: string[];
  baseUrl: string;
  heading?: string;
  description?: string;
  ticketLabelPrefix?: string;
}

export default function TicketLinksSection({
  ticketIds,
  baseUrl,
  heading = "Your Tickets",
  description = "Present these QR codes at the event entrance for entry:",
  ticketLabelPrefix = "Ticket",
}: TicketLinksSectionProps) {
  if (ticketIds.length === 0) {
    return null;
  }

  return (
    <Section style={sectionStyle}>
      <Text style={headingStyle}>{heading}</Text>
      <Text style={descriptionStyle}>{description}</Text>
      {ticketIds.map((ticketId, index) => (
        <div key={ticketId} style={ticketContainerStyle}>
          <Text style={ticketLabelStyle}>
            {ticketLabelPrefix} {index + 1}
          </Text>
          <Img
            src={`${baseUrl}/profile/tickets/${ticketId}.png`}
            alt={`QR Code for ${ticketLabelPrefix} ${index + 1}`}
            width="200"
            height="200"
            style={qrCodeStyle}
          />
          <Text style={uuidStyle}>ID: {ticketId}</Text>
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
  color: "#1f2937",
  marginBottom: "12px",
};

const descriptionStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#4b5563",
  marginBottom: "16px",
};

const ticketContainerStyle: React.CSSProperties = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "16px",
  textAlign: "center",
};

const ticketLabelStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "600",
  color: "#1f2937",
  marginBottom: "16px",
  marginTop: "0",
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
  marginTop: "12px",
  marginBottom: "0",
  fontFamily: "monospace",
};
