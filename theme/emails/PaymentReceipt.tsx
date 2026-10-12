/** @jsxImportSource react */

import { Section, Text } from "@react-email/components";
import type { PaymentReceiptEmailProps } from "~/contracts/emails";
import { t } from "~/contracts/i18n";
import { colors } from "~theme/tokens/tokens";
import EmailLayout from "./EmailLayout";

/** The generic receipt for a paid payment: lines, total, date and reference. */
export default function PaymentReceiptEmail({
	baseUrl,
	recipientName,
	date,
	reference,
	lines,
	total,
	note,
}: PaymentReceiptEmailProps) {
	const cell = { padding: "8px 0", color: colors.text, fontSize: "14px" };
	return (
		<EmailLayout
			title={t("theme.emailPaymentReceipt.paymentReceipt")}
			subtitle={date}
			baseUrl={baseUrl}
		>
			<Text
				style={{ fontSize: "18px", marginBottom: "16px", color: colors.text }}
			>
				{t("theme.emailPaymentReceipt.hello", { recipientName })}
			</Text>
			<Text style={{ color: colors["text-secondary"], marginBottom: "16px" }}>
				{t("theme.emailPaymentReceipt.thankYouForYourPayment")}
				{note ? ` ${note}.` : ""}
			</Text>
			<Section style={{ marginBottom: "24px" }}>
				<table style={{ width: "100%", borderCollapse: "collapse" }}>
					<tbody>
						{lines.map((line) => (
							<tr key={`${line.label}-${line.amount}`}>
								<td style={cell}>
									{line.quantity} × {line.label}
								</td>
								<td style={{ ...cell, textAlign: "right" }}>{line.amount}</td>
							</tr>
						))}
						<tr>
							<td style={{ ...cell, fontWeight: 700 }}>
								{t("theme.emailPaymentReceipt.total")}
							</td>
							<td style={{ ...cell, fontWeight: 700, textAlign: "right" }}>
								{total}
							</td>
						</tr>
					</tbody>
				</table>
			</Section>
			<Text style={{ color: colors["text-secondary"], fontSize: "12px" }}>
				{t("theme.emailPaymentReceipt.receiptNumber", { reference })}
			</Text>
		</EmailLayout>
	);
}
