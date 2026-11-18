/** @jsxImportSource react */

import { Section, Text } from "@react-email/components";
import type * as React from "react";
import { formatCurrency, t } from "~/contracts/i18n";
import { colors } from "~theme/tokens/tokens";

export interface TransactionProduct {
	name: string;
	quantity: number;
	amount?: number;
	unitPrice?: number;
}

export interface TransactionProductsSummaryProps {
	products: TransactionProduct[];
	totalAmount?: number;
	showTotal?: boolean;
}

export default function TransactionProductsSummary({
	products,
	totalAmount,
	showTotal = true,
}: TransactionProductsSummaryProps) {
	// Calculate total if not provided
	const calculatedTotal =
		totalAmount ??
		products.reduce((sum, product) => {
			const price = product.amount ?? product.unitPrice ?? 0;
			return sum + price * product.quantity;
		}, 0);

	return (
		<Section style={sectionStyle}>
			<Text style={headingStyle}>
				{t("theme.emailTransactionProductsSummary.orderSummary")}
			</Text>
			<table style={tableStyle}>
				<thead>
					<tr style={headerRowStyle}>
						<th style={headerCellStyle}>
							{t("theme.emailTransactionProductsSummary.item")}
						</th>
						<th style={headerCellStyle}>
							{t("theme.emailTransactionProductsSummary.qty")}
						</th>
						<th style={headerCellStyle}>
							{t("theme.emailTransactionProductsSummary.price")}
						</th>
						<th style={headerCellStyle}>
							{t("theme.emailTransactionProductsSummary.total")}
						</th>
					</tr>
				</thead>
				<tbody>
					{products.map((product, index) => {
						const price = product.amount ?? product.unitPrice ?? 0;
						const total = price * product.quantity;
						return (
							<tr key={index} style={bodyRowStyle}>
								<td style={bodyCellStyle}>{product.name}</td>
								<td style={bodyCellStyle}>{product.quantity}</td>
								<td style={bodyCellStyle}>{formatCurrency(price, "EUR")}</td>
								<td style={bodyCellStyle}>{formatCurrency(total, "EUR")}</td>
							</tr>
						);
					})}
					{showTotal && (
						<tr style={finalTotalRowStyle}>
							<td colSpan={3} style={finalTotalLabelCellStyle}>
								{t("theme.emailTransactionProductsSummary.totalPaid")}
							</td>
							<td style={finalTotalValueCellStyle}>
								{formatCurrency(calculatedTotal, "EUR")}
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</Section>
	);
}

const sectionStyle: React.CSSProperties = {
	marginTop: "24px",
	marginBottom: "24px",
};

const headingStyle: React.CSSProperties = {
	fontSize: "20px",
	fontWeight: "700",
	color: colors.text,
	marginBottom: "12px",
	marginTop: "0",
};

const tableStyle: React.CSSProperties = {
	width: "100%",
	borderCollapse: "collapse" as const,
	marginTop: "16px",
};

const headerRowStyle: React.CSSProperties = {
	backgroundColor: colors["bg-muted"],
	borderBottom: `2px solid ${colors.border}`,
};

const headerCellStyle: React.CSSProperties = {
	padding: "12px 8px",
	textAlign: "left" as const,
	fontSize: "14px",
	fontWeight: "600",
	color: colors["text-secondary"],
	lineHeight: "1.5",
};

const bodyRowStyle: React.CSSProperties = {
	borderBottom: `1px solid ${colors.border}`,
};

const bodyCellStyle: React.CSSProperties = {
	padding: "12px 8px",
	fontSize: "14px",
	color: colors["text-secondary"],
	lineHeight: "1.5",
};

const finalTotalRowStyle: React.CSSProperties = {
	borderTop: `2px solid ${colors.border}`,
	backgroundColor: colors.bg,
};

const finalTotalLabelCellStyle: React.CSSProperties = {
	padding: "12px 8px",
	textAlign: "right" as const,
	fontSize: "16px",
	fontWeight: "700",
	color: colors["text-heading"],
	lineHeight: "1.5",
};

const finalTotalValueCellStyle: React.CSSProperties = {
	padding: "12px 8px",
	fontSize: "16px",
	fontWeight: "700",
	color: colors["text-heading"],
	lineHeight: "1.5",
};
