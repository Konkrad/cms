/** @jsxImportSource react */

import { Button, Section, Text } from "@react-email/components";
import type { JobApprovedEmailProps } from "~/contracts/emails";
import { colors } from "~theme/tokens/tokens";
import EmailLayout from "./EmailLayout";

/** Tells a member that the job they suggested is now live on the job board. */
export default function JobApprovedEmail({
	baseUrl,
	recipientName,
	jobTitle,
	jobUrl,
	unsubscribeUrl,
}: JobApprovedEmailProps) {
	return (
		<EmailLayout
			title="Your job is live"
			subtitle="Job board"
			baseUrl={baseUrl}
			unsubscribeUrl={unsubscribeUrl}
		>
			<Text
				style={{ fontSize: "18px", marginBottom: "16px", color: colors.text }}
			>
				Hello {recipientName}!
			</Text>
			<Text style={{ color: colors["text-secondary"], marginBottom: "24px" }}>
				Your job posting <strong>{jobTitle}</strong> has been approved and is
				now visible on the job board.
			</Text>
			<Section style={{ textAlign: "center", marginBottom: "24px" }}>
				<Button
					href={jobUrl}
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
					View the job
				</Button>
			</Section>
		</EmailLayout>
	);
}
