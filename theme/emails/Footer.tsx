/** @jsxImportSource react */

import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { emailBrand } from "~theme/emails/brand";
import { colors, fonts } from "~theme/tokens/tokens";

const Footer = ({ unsubscribeUrl }: { unsubscribeUrl?: string | null }) => {
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
			<Text
				style={{ margin: "0", color: colors["text-muted"], fontSize: "14px" }}
			>
				© {new Date().getFullYear()} {emailBrand.footerCopyright}. All rights
				reserved.
			</Text>
			{unsubscribeUrl && (
				<Text
					style={{
						margin: "8px 0 0",
						color: colors["text-muted"],
						fontSize: "12px",
					}}
				>
					<Link href={unsubscribeUrl} style={{ color: colors["text-muted"] }}>
						Unsubscribe from these emails
					</Link>
				</Text>
			)}
		</Section>
	);
};

export default Footer;
