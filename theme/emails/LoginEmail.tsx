/** @jsxImportSource react */
import React from "react";
import { Text, Section, Button, Hr } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import { emailBrand } from "./brand";
import { colors } from "~theme/tokens/tokens";
import type { LoginEmailProps } from "~/contracts/emails";

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
      title={`Sign in to ${appName}`}
      subtitle="Authentication Request"
      baseUrl={baseUrl}
    >
      {/* Greeting */}
      <Text
        style={{ fontSize: "16px", marginBottom: "16px", color: colors.text }}
      >
        Use the button below to sign in, or copy the 6-letter code into the
        site.
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
          Sign in to {appName}
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
          Or enter this code:
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
          The link and code expire in {expiresInMinutes} minutes.
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
          If you didn't request this, you can safely ignore this email.
        </Text>
        <Text
          style={{
            fontSize: "13px",
            color: colors["text-muted"],
          }}
        >
          For security reasons, do not share your code or sign-in link with
          anyone.
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
