import { Text, Section, Heading } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";
import TicketLinksSection from "./components/TicketLinksSection";
import TransactionProductsSummary from "./components/TransactionProductsSummary";

interface EventEmailProps {
  baseUrl: string;
  event: {
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    url: string;
    description: string;
  };
  transaction: {
    buyerName: string;
    products: {
      name: string;
      amount: number;
      quantity: number;
    }[];
  };
  hasTickets: boolean;
  ticketIds: string[];
}

const EventEmail = ({
  baseUrl,
  event,
  transaction,
  hasTickets,
  ticketIds,
}: EventEmailProps) => {
  return (
    <EmailLayout
      title={event.title}
      subtitle="Event Confirmation & Tickets"
      baseUrl={baseUrl}
    >
      {/* Greeting */}
      <Text
        style={{ fontSize: "18px", marginBottom: "16px", color: "#1f2937" }}
      >
        Hello {transaction.buyerName}!
      </Text>
      <Text style={{ color: "#4b5563", marginBottom: "24px" }}>
        Thank you for your purchase! Here are the details of your event
        registration:
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
          }}
        >
          {event.title}
        </Heading>
        <Text style={{ color: "#4b5563", marginBottom: "8px" }}>
          <strong>Location:</strong> {event.location}
        </Text>
        <Text style={{ color: "#4b5563", marginBottom: "8px" }}>
          <strong>Start:</strong> {event.startDate}
        </Text>
        <Text style={{ color: "#4b5563", marginBottom: "8px" }}>
          <strong>End:</strong> {event.endDate}
        </Text>
        <Text style={{ color: "#4b5563", marginBottom: "8px" }}>
          <strong>More info:</strong>{" "}
          <a
            href={event.url}
            style={{ color: "#075de6", textDecoration: "underline" }}
          >
            {event.url}
          </a>
        </Text>
        <Text style={{ color: "#4b5563" }}>{event.description}</Text>
      </Section>

      {/* Purchase Summary */}
      <TransactionProductsSummary products={transaction.products} />

      {/* Tickets Section */}
      {hasTickets && (
        <TicketLinksSection
          ticketIds={ticketIds}
          baseUrl={baseUrl}
          heading="Your Tickets"
          description="Please save these ticket QR codes. You'll need to present them at the event:"
          ticketLabelPrefix="Ticket"
        />
      )}

      {/* Footer Note */}
      <Text style={{ color: "#6b7280", fontSize: "14px", lineHeight: "1.5" }}>
        If you have any questions, please don't hesitate to contact us. We look
        forward to seeing you at the event!
      </Text>
    </EmailLayout>
  );
};

EventEmail.PreviewProps = {
  baseUrl: "http://localhost:3000",
  event: {
    title: "React Conference 2024",
    location: "Berlin Congress Center",
    startDate: "June 15, 2024, 10:00 AM",
    endDate: "June 15, 2024, 6:00 PM",
    url: "https://example.com/events/react-conf-2024",
    description: "Join us for a day of React talks and networking.",
  },
  transaction: {
    buyerName: "Jane Doe",
    products: [
      { name: "Conference Ticket", amount: 99.99, quantity: 3 },
      { name: "Workshop Access", amount: 49.99, quantity: 1 },
    ],
  },
  hasTickets: true,
  ticketIds: ["abc123-uuid-ticket-id-1", "def456-uuid-ticket-id-2"],
};

export default EventEmail;
