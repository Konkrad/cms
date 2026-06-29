/** @jsxImportSource react */
import React from "react";
import { Html, Head, Body, Container, Tailwind } from "@react-email/components";
import Header from "./Header";
import Footer from "./Footer";
import { colors, fonts } from "~theme/tokens/tokens";

interface EmailLayoutProps {
  title: string;
  subtitle: string;
  baseUrl: string;
  children: React.ReactNode;
}

const EmailLayout = ({ title, subtitle, baseUrl, children }: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: colors.primary,
                secondary: colors["primary-light"],
                background: colors.bg,
                textPrimary: colors.text,
                textSecondary: colors["text-secondary"],
                border: colors.border,
              },
              fontFamily: {
                sans: fonts.sans,
              },
            },
          },
        }}
      >
        <Body className="bg-background font-sans">
          <Container className="max-w-[600px] mx-auto bg-white shadow-md">
            {/* Header */}
            <Header title={title} subtitle={subtitle} baseUrl={baseUrl} />

            {/* Main Content */}
            <div className="p-6">{children}</div>

            {/* Footer */}
            <Footer />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailLayout;
