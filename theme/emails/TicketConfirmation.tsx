/** @jsxImportSource react */

import { Heading, Hr, Section, Text } from "@react-email/components";
import React from "react";
import type { TicketConfirmationEmailProps } from "~/contracts/emails";
import { t } from "~/contracts/i18n";
import { colors } from "~theme/tokens/tokens";
import EmailLayout from "./EmailLayout";
import TicketLinksSection from "./TicketLinksSection";
import TransactionProductsSummary from "./TransactionProductsSummary";

const TicketConfirmationEmail = ({
	baseUrl,
	event,
	transaction,
	hasTickets,
	tickets,
}: TicketConfirmationEmailProps) => {
	return (
		<EmailLayout
			title={event.title}
			subtitle={t("theme.emailTicketConfirmation.purchaseConfirmationTickets")}
			baseUrl={baseUrl}
		>
			{/* Success Message */}
			<Section
				style={{
					textAlign: "center",
					padding: "20px",
					backgroundColor: colors["success-bg"],
					borderRadius: "8px",
					marginBottom: "24px",
				}}
			>
				<Text
					style={{
						fontSize: "24px",
						fontWeight: "bold",
						color: colors.success,
						marginBottom: "8px",
					}}
				>
					{t("theme.emailTicketConfirmation.purchaseConfirmed")}
				</Text>
				<Text style={{ fontSize: "16px", color: colors.success, margin: "0" }}>
					{t("theme.emailTicketConfirmation.thankYouForYourPurchase")}
				</Text>
			</Section>

			{/* Greeting */}
			<Text
				style={{ fontSize: "18px", marginBottom: "16px", color: colors.text }}
			>
				{t("theme.emailTicketConfirmation.hello", {
					buyerName: transaction.buyerName,
				})}
			</Text>
			<Text style={{ color: colors["text-secondary"], marginBottom: "24px" }}>
				{t("theme.emailTicketConfirmation.yourPurchaseFor")}{" "}
				<strong>{event.title}</strong>{" "}
				{t("theme.emailTicketConfirmation.hasBeenConfirmed")}
				{hasTickets &&
					t("theme.emailTicketConfirmation.yourTicketsAreReadyBelow")}
			</Text>

			{/* Event Details */}
			<Section
				style={{
					marginBottom: "24px",
					padding: "16px",
					backgroundColor: colors.bg,
					borderRadius: "8px",
				}}
			>
				<Heading
					as="h2"
					style={{
						fontSize: "20px",
						fontWeight: "bold",
						color: colors.text,
						marginBottom: "12px",
						marginTop: "0",
					}}
				>
					{t("theme.emailTicketConfirmation.eventDetails")}
				</Heading>
				<Text style={{ color: colors["text-secondary"], marginBottom: "8px" }}>
					<strong>{t("theme.emailTicketConfirmation.event")}</strong>{" "}
					{event.title}
				</Text>
				<Text style={{ color: colors["text-secondary"], marginBottom: "8px" }}>
					<strong>{t("theme.emailTicketConfirmation.date")}</strong>{" "}
					{event.date}
				</Text>
				{event.location && (
					<Text style={{ color: colors["text-secondary"], marginBottom: "0" }}>
						<strong>{t("theme.emailTicketConfirmation.location")}</strong>{" "}
						{event.location}
					</Text>
				)}
			</Section>

			{/* Purchase Summary */}
			<TransactionProductsSummary
				products={transaction.products}
				totalAmount={transaction.totalAmount}
			/>

			{/* Tickets Section */}
			{hasTickets && (
				<>
					<Hr style={{ borderColor: colors.border, margin: "24px 0" }} />
					<TicketLinksSection
						tickets={tickets}
						baseUrl={baseUrl}
						heading={t("theme.emailTicketConfirmation.yourTickets")}
						description={t(
							"theme.emailTicketConfirmation.pleaseSaveTheseTicketQr",
						)}
						ticketLabelPrefix={t("theme.emailTicketConfirmation.ticket")}
					/>
				</>
			)}

			<Hr style={{ borderColor: colors.border, margin: "24px 0" }} />

			{/* Instructions */}
			<Section style={{ marginBottom: "24px" }}>
				<Heading
					as="h3"
					style={{
						fontSize: "18px",
						fontWeight: "700",
						color: colors.text,
						marginBottom: "12px",
						marginTop: "0",
					}}
				>
					{t("theme.emailTicketConfirmation.whatSNext")}
				</Heading>
				<ul style={{ paddingLeft: "20px", margin: "0" }}>
					{hasTickets && (
						<>
							<li
								style={{
									fontSize: "14px",
									color: colors["text-secondary"],
									lineHeight: "1.6",
									marginBottom: "8px",
								}}
							>
								<strong>
									{t("theme.emailTicketConfirmation.saveYourTickets")}
								</strong>{" "}
								{t("theme.emailTicketConfirmation.downloadOrScreenshotTheQr")}
							</li>
							<li
								style={{
									fontSize: "14px",
									color: colors["text-secondary"],
									lineHeight: "1.6",
									marginBottom: "8px",
								}}
							>
								<strong>{t("theme.emailTicketConfirmation.atTheEvent")}</strong>{" "}
								{t("theme.emailTicketConfirmation.presentYourQrCodeAt")}
							</li>
						</>
					)}
					<li
						style={{
							fontSize: "14px",
							color: colors["text-secondary"],
							lineHeight: "1.6",
							marginBottom: "0",
						}}
					>
						<strong>{t("theme.emailTicketConfirmation.needHelp")}</strong>{" "}
						{t(
							"theme.emailTicketConfirmation.contactSupportWithYourTransaction",
						)}{" "}
						<code
							style={{
								backgroundColor: colors["bg-muted"],
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
					color: colors["text-muted"],
					fontSize: "14px",
					lineHeight: "1.5",
					marginBottom: "0",
				}}
			>
				{t("theme.emailTicketConfirmation.thisIsAConfirmationOf")}
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
	},
	hasTickets: true,
	tickets: [
		{ id: "ticket-uuid-001-abc123", qrCodeUuid: "qr-uuid-001" },
		{ id: "ticket-uuid-002-def456", qrCodeUuid: "qr-uuid-002" },
		{ id: "ticket-uuid-003-ghi789", qrCodeUuid: "qr-uuid-003" },
	],
} as TicketConfirmationEmailProps;

export default TicketConfirmationEmail;
