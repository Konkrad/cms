/** @jsxImportSource react */
import { Section, Text } from "@react-email/components";
import type * as React from "react";

export interface TransactionProduct {
  name: string;
  quantity: number;
  amount?: number;
  unitPrice?: number;
}

export interface TransactionProductsSummaryProps {
  products: TransactionProduct[];
  totalAmount?: number;
  transactionFee?: number;
  showTotal?: boolean;
}

export default function TransactionProductsSummary({
  products,
  totalAmount,
  transactionFee = 0,
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
      <Text style={headingStyle}>Order Summary</Text>
      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={headerCellStyle}>Item</th>
            <th style={headerCellStyle}>Qty</th>
            <th style={headerCellStyle}>Price</th>
            <th style={headerCellStyle}>Total</th>
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
                <td style={bodyCellStyle}>€{price.toFixed(2)}</td>
                <td style={bodyCellStyle}>€{total.toFixed(2)}</td>
              </tr>
            );
          })}
          {showTotal && (
            <>
              <tr style={totalRowStyle}>
                <td colSpan={3} style={totalLabelCellStyle}>
                  Subtotal
                </td>
                <td style={totalValueCellStyle}>
                  €{calculatedTotal.toFixed(2)}
                </td>
              </tr>
              {transactionFee > 0 && (
                <tr style={totalRowStyle}>
                  <td colSpan={3} style={totalLabelCellStyle}>
                    Processing Fee
                  </td>
                  <td style={totalValueCellStyle}>
                    €{transactionFee.toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={finalTotalRowStyle}>
                <td colSpan={3} style={finalTotalLabelCellStyle}>
                  Total Paid
                </td>
                <td style={finalTotalValueCellStyle}>
                  €{(calculatedTotal + transactionFee).toFixed(2)}
                </td>
              </tr>
            </>
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
  color: "#1f2937",
  marginBottom: "12px",
  marginTop: "0",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  marginTop: "16px",
};

const headerRowStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderBottom: "2px solid #e5e7eb",
};

const headerCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  textAlign: "left" as const,
  fontSize: "14px",
  fontWeight: "600",
  color: "#374151",
  lineHeight: "1.5",
};

const bodyRowStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
};

const bodyCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: "14px",
  color: "#4b5563",
  lineHeight: "1.5",
};

const totalRowStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
};

const totalLabelCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  textAlign: "right" as const,
  fontSize: "14px",
  fontWeight: "500",
  color: "#6b7280",
  lineHeight: "1.5",
};

const totalValueCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: "14px",
  fontWeight: "500",
  color: "#4b5563",
  lineHeight: "1.5",
};

const finalTotalRowStyle: React.CSSProperties = {
  borderTop: "2px solid #e5e7eb",
  backgroundColor: "#f9fafb",
};

const finalTotalLabelCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  textAlign: "right" as const,
  fontSize: "16px",
  fontWeight: "700",
  color: "#111827",
  lineHeight: "1.5",
};

const finalTotalValueCellStyle: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: "16px",
  fontWeight: "700",
  color: "#111827",
  lineHeight: "1.5",
};
