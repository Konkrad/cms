/** @jsxImportSource react */

import { Button, Section, Text } from "@react-email/components";
import type { NoticeEmailProps } from "~/contracts/emails";
import { colors } from "~theme/tokens/tokens";
import EmailLayout from "./EmailLayout";

/** A short notice with one button (reviews, debrief requests). All text is plain text. */
export default function NoticeEmail({
	baseUrl,
	recipientName,
	title,
	subtitle,
	paragraphs,
	quote,
	buttonLabel,
	buttonUrl,
	unsubscribeUrl,
}: NoticeEmailProps) {
	return (
		<EmailLayout
			title={title}
			subtitle={subtitle}
			baseUrl={baseUrl}
			unsubscribeUrl={unsubscribeUrl}
		>
			<Text
				style={{ fontSize: "18px", marginBottom: "16px", color: colors.text }}
			>
				Hello {recipientName}!
			</Text>
			{paragraphs.map((p) => (
				<Text
					key={p}
					style={{ color: colors["text-secondary"], marginBottom: "16px" }}
				>
					{p}
				</Text>
			))}
			{quote && (
				<Text
					style={{
						color: colors.text,
						borderLeft: `4px solid ${colors.primary}`,
						paddingLeft: "12px",
						marginBottom: "24px",
						whiteSpace: "pre-wrap",
					}}
				>
					{quote}
				</Text>
			)}
			<Section style={{ textAlign: "center", marginBottom: "24px" }}>
				<Button
					href={buttonUrl}
					style={{
						backgroundColor: colors.primary,
						color: colors["bg-card"],
						textDecoration: "none",
						borderRadius: "6px",
						display: "inline-block",
						fontWeight: "600",
						fontSize: "16px",
						padding: "12px 24px",
					}}
				>
					{buttonLabel}
				</Button>
			</Section>
		</EmailLayout>
	);
}
