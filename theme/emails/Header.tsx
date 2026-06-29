/** @jsxImportSource react */
import React from "react";
import { Img, Heading, Text } from "@react-email/components";
import { emailBrand } from "~theme/emails/brand";
import { colors, fonts } from "~theme/tokens/tokens";

interface HeaderProps {
  title: string;
  subtitle: string;
  baseUrl: string;
}

const Header = ({ title, subtitle, baseUrl }: HeaderProps) => {
  return (
    <div
      style={{
        padding: "24px",
        textAlign: "center",
        backgroundColor: colors.primary,
        fontFamily: fonts.sans.join(", "),
      }}
    >
      <Img
        src={`${baseUrl}/static/logo.svg`}
        alt={emailBrand.logoAlt}
        style={{
          maxWidth: "150px",
          margin: "0 auto 16px auto",
          display: "block",
        }}
      />
      <Heading
        as="h1"
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          color: colors["bg-card"],
          marginBottom: "8px",
          marginTop: "0",
        }}
      >
        {title}
      </Heading>
      <Text
        style={{
          fontSize: "16px",
          color: colors["bg-card"],
          opacity: 0.85,
          margin: "0",
        }}
      >
        {subtitle}
      </Text>
    </div>
  );
};

export default Header;
