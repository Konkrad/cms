import React from "react";
import { Html, Head, Body, Container, Tailwind } from "@react-email/components";
import Header from "./Header";
import Footer from "./Footer";

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
                primary: "#075de6",
                secondary: "#3b82f6",
                background: "#f9fafb",
                textPrimary: "#1f2937",
                textSecondary: "#4b5563",
                border: "#e5e7eb",
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
