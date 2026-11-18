/** @jsxImportSource react */

import { Button, Section, Text } from "@react-email/components";
import type { JobApprovedEmailProps } from "~/contracts/emails";
import { t } from "~/contracts/i18n";
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
			title={t("theme.emailJobApproved.yourJobIsLive")}
			subtitle={t("theme.emailJobApproved.jobBoard")}
			baseUrl={baseUrl}
			unsubscribeUrl={unsubscribeUrl}
		>
			<Text
				style={{ fontSize: "18px", marginBottom: "16px", color: colors.text }}
			>
				{t("theme.emailJobApproved.hello", { recipientName })}
			</Text>
			<Text style={{ color: colors["text-secondary"], marginBottom: "24px" }}>
				{t("theme.emailJobApproved.yourJobPosting")} <strong>{jobTitle}</strong>{" "}
				{t("theme.emailJobApproved.hasBeenApprovedAndIs")}
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
					{t("theme.emailJobApproved.viewTheJob")}
				</Button>
			</Section>
		</EmailLayout>
	);
}
