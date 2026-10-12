/** @jsxImportSource react */

import { Section, Text } from "@react-email/components";
import type { PaymentReceiptEmailProps } from "~/contracts/emails";
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
		<EmailLayout title="Payment receipt" subtitle={date} baseUrl={baseUrl}>
			<Text
				style={{ fontSize: "18px", marginBottom: "16px", color: colors.text }}
			>
				Hello {recipientName}!
			</Text>
			<Text style={{ color: colors["text-secondary"], marginBottom: "16px" }}>
				Thank you for your payment. This is your receipt.
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
							<td style={{ ...cell, fontWeight: 700 }}>Total</td>
							<td style={{ ...cell, fontWeight: 700, textAlign: "right" }}>
								{total}
							</td>
						</tr>
					</tbody>
				</table>
			</Section>
			<Text style={{ color: colors["text-secondary"], fontSize: "12px" }}>
				Receipt number: {reference}
			</Text>
		</EmailLayout>
	);
}
