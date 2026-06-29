/** @jsxImportSource react */
import React from "react";
import { Section, Text } from "@react-email/components";
import { emailBrand } from "~theme/emails/brand";
import { colors, fonts } from "~theme/tokens/tokens";

const Footer = () => {
  return (
    <Section
      className="footer"
      style={{
        padding: "16px",
        textAlign: "center",
        backgroundColor: colors["bg-muted"],
        fontFamily: fonts.sans.join(", "),
      }}
    >
      <Text style={{ margin: "0", color: colors["text-muted"], fontSize: "14px" }}>
        © {new Date().getFullYear()} {emailBrand.footerCopyright}. All rights reserved.
      </Text>
    </Section>
  );
};

export default Footer;
