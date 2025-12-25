/** @jsxImportSource react */
import { Section, Text, Row, Column } from "@react-email/components";
import type * as React from "react";

export interface TransactionProduct {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface TransactionProductsSummaryProps {
  products: TransactionProduct[];
  totalAmount: number;
  transactionFee?: number;
}

export default function TransactionProductsSummary({
  products,
  totalAmount,
  transactionFee = 0,
}: TransactionProductsSummaryProps) {
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
          {products.map((product, index) => (
            <tr key={index} style={bodyRowStyle}>
              <td style={bodyCellStyle}>{product.name}</td>
              <td style={bodyCellStyle}>{product.quantity}</td>
              <td style={bodyCellStyle}>€{product.unitPrice.toFixed(2)}</td>
              <td style={bodyCellStyle}>
                €{(product.quantity * product.unitPrice).toFixed(2)}
              </td>
            </tr>
          ))}
          <tr style={totalRowStyle}>
            <td colSpan={3} style={totalLabelCellStyle}>
              Subtotal
            </td>
            <td style={totalValueCellStyle}>€{totalAmount.toFixed(2)}</td>
          </tr>
          {transactionFee > 0 && (
            <tr style={totalRowStyle}>
              <td colSpan={3} style={totalLabelCellStyle}>
                Processing Fee
              </td>
              <td style={totalValueCellStyle}>€{transactionFee.toFixed(2)}</td>
            </tr>
          )}
          <tr style={finalTotalRowStyle}>
            <td colSpan={3} style={finalTotalLabelCellStyle}>
              Total Paid
            </td>
            <td style={finalTotalValueCellStyle}>
              €{(totalAmount + transactionFee).toFixed(2)}
            </td>
          </tr>
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
  fontWeight: "bold",
  marginBottom: "12px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "16px",
};

const headerRowStyle: React.CSSProperties = {
  backgroundColor: "#f3f4f6",
  borderBottom: "2px solid #e5e7eb",
};

const headerCellStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "left",
  fontSize: "14px",
  fontWeight: "600",
  color: "#374151",
};

const bodyRowStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
};

const bodyCellStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  color: "#4b5563",
};

const totalRowStyle: React.CSSProperties = {
  borderTop: "1px solid #e5e7eb",
};

const totalLabelCellStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "right",
  fontSize: "14px",
  fontWeight: "500",
  color: "#6b7280",
};

const totalValueCellStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  fontWeight: "500",
  color: "#4b5563",
};

const finalTotalRowStyle: React.CSSProperties = {
  borderTop: "2px solid #e5e7eb",
  backgroundColor: "#f9fafb",
};

const finalTotalLabelCellStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "right",
  fontSize: "16px",
  fontWeight: "700",
  color: "#111827",
};

const finalTotalValueCellStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "16px",
  fontWeight: "700",
  color: "#111827",
};
