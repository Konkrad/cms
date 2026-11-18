/** @jsxImportSource react */

import { Button, Hr, Section, Text } from "@react-email/components";
import React from "react";
import type { LoginEmailProps } from "~/contracts/emails";
import { t } from "~/contracts/i18n";
import { colors } from "~theme/tokens/tokens";
import { emailBrand } from "./brand";
import EmailLayout from "./EmailLayout";

/**
 * LoginEmail
 *
 * Email template that contains both a magic link and a 6-letter OTP.
 */
export default function LoginEmail({
	link,
	code,
	appName = emailBrand.siteName,
	baseUrl,
	expiresInMinutes = 15,
}: LoginEmailProps) {
	return (
		<EmailLayout
			title={t("theme.emailLogin.signInTo", { appName })}
			subtitle={t("theme.emailLogin.authenticationRequest")}
			baseUrl={baseUrl}
		>
			{/* Greeting */}
			<Text
				style={{ fontSize: "16px", marginBottom: "16px", color: colors.text }}
			>
				{t("theme.emailLogin.useTheButtonBelowTo")}
			</Text>

			{/* Sign In Button */}
			<Section style={{ textAlign: "center", marginBottom: "24px" }}>
				<Button
					href={link}
					style={{
						backgroundColor: colors.primary,
						color: colors["bg-card"],
						textDecoration: "none",
						borderRadius: "6px",
						display: "inline-block",
						fontWeight: "600",
						fontSize: "16px",
						padding: "12px 24px",
						border: "none",
					}}
				>
					{t("theme.emailLogin.signInTo", { appName })}
				</Button>
			</Section>

			{/* Code Section */}
			<Section
				style={{
					textAlign: "center",
					padding: "20px",
					backgroundColor: colors.bg,
					borderRadius: "8px",
					marginBottom: "24px",
				}}
			>
				<Text
					style={{
						fontSize: "14px",
						color: colors["text-secondary"],
						marginBottom: "12px",
					}}
				>
					{t("theme.emailLogin.orEnterThisCode")}
				</Text>
				<Text
					style={{
						display: "inline-block",
						padding: "12px 20px",
						backgroundColor: colors["bg-card"],
						border: `2px solid ${colors.border}`,
						borderRadius: "6px",
						fontSize: "24px",
						fontWeight: "700",
						letterSpacing: "4px",
						color: colors.text,
						fontFamily: "monospace",
					}}
				>
					{code}
				</Text>
				<Text
					style={{
						fontSize: "13px",
						color: colors["text-muted"],
						marginTop: "12px",
					}}
				>
					{t("theme.emailLogin.theLinkAndCodeExpire", { expiresInMinutes })}
				</Text>
			</Section>

			<Hr style={{ borderColor: colors.border, margin: "24px 0" }} />

			{/* Security Notice */}
			<Section>
				<Text
					style={{
						fontSize: "14px",
						color: colors["text-secondary"],
						marginBottom: "8px",
					}}
				>
					{t("theme.emailLogin.ifYouDidnTRequest")}
				</Text>
				<Text
					style={{
						fontSize: "13px",
						color: colors["text-muted"],
					}}
				>
					{t("theme.emailLogin.forSecurityReasonsDoNot")}
				</Text>
			</Section>
		</EmailLayout>
	);
}

LoginEmail.PreviewProps = {
	baseUrl: "http://localhost:3000",
	link: "http://localhost:3000/auth/verify?token=abc123def456",
	code: "XYZ123",
	appName: emailBrand.siteName,
	expiresInMinutes: 15,
} as LoginEmailProps;
