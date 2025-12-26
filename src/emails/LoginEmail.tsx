/** @jsxImportSource react */
import React from "react";
import { Text, Section, Button, Hr } from "@react-email/components";
import EmailLayout from "./components/EmailLayout";

export interface LoginEmailProps {
  link: string;
  code: string;
  appName?: string;
  baseUrl: string;
  expiresInMinutes?: number;
}

/**
 * LoginEmail
 *
 * Email template that contains both a magic link and a 6-letter OTP.
 */
export default function LoginEmail({
  link,
  code,
  appName = "EIT Digital Alumni",
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
        style={{ fontSize: "16px", marginBottom: "16px", color: "#1f2937" }}
      >
        Use the button below to sign in, or copy the 6-letter code into the
        site.
      </Text>

      {/* Sign In Button */}
      <Section style={{ textAlign: "center", marginBottom: "24px" }}>
        <Button
          href={link}
          style={{
            backgroundColor: "#075de6",
            color: "white",
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
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          marginBottom: "24px",
        }}
      >
        <Text
          style={{
            fontSize: "14px",
            color: "#4b5563",
            marginBottom: "12px",
          }}
        >
          Or enter this code:
        </Text>
        <Text
          style={{
            display: "inline-block",
            padding: "12px 20px",
            backgroundColor: "#ffffff",
            border: "2px solid #e5e7eb",
            borderRadius: "6px",
            fontSize: "24px",
            fontWeight: "700",
            letterSpacing: "4px",
            color: "#1f2937",
            fontFamily: "monospace",
          }}
        >
          {code}
        </Text>
        <Text
          style={{
            fontSize: "13px",
            color: "#6b7280",
            marginTop: "12px",
          }}
        >
          The link and code expire in {expiresInMinutes} minutes.
        </Text>
      </Section>

      <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0" }} />

      {/* Security Notice */}
      <Section>
        <Text
          style={{
            fontSize: "14px",
            color: "#4b5563",
            marginBottom: "8px",
          }}
        >
          If you didn't request this, you can safely ignore this email.
        </Text>
        <Text
          style={{
            fontSize: "13px",
            color: "#6b7280",
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
  appName: "EIT Digital Alumni",
  expiresInMinutes: 15,
} as LoginEmailProps;
