/** @jsxImportSource react */
import React from "react";
import { Section, Text } from "@react-email/components";

const Footer = () => {
  return (
    <Section
      className="footer"
      style={{
        padding: "16px",
        textAlign: "center",
        backgroundColor: "#f3f4f6",
      }}
    >
      <Text style={{ margin: "0", color: "#6b7280", fontSize: "14px" }}>
        © {new Date().getFullYear()} EIT Digital Alumni. All rights reserved.
      </Text>
    </Section>
  );
};

export default Footer;
