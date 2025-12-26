/** @jsxImportSource react */
import React from "react";
import { Img, Heading, Text } from "@react-email/components";

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
        backgroundColor: "#075de6",
      }}
    >
      <Img
        src={`${baseUrl}/static/logo.svg`}
        alt="EIT Digital Alumni Logo"
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
          color: "#ffffff",
          marginBottom: "8px",
          marginTop: "0",
        }}
      >
        {title}
      </Heading>
      <Text
        style={{
          fontSize: "16px",
          color: "#e0e7ff",
          margin: "0",
        }}
      >
        {subtitle}
      </Text>
    </div>
  );
};

export default Header;
