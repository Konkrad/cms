/** @jsxImportSource react */

import { Link, Section, Text } from "@react-email/components";
import React from "react";
import { t } from "~/contracts/i18n";
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
				{t("theme.emailFooter.allRightsReserved", {
					year: new Date().getFullYear(),
					footerCopyright: emailBrand.footerCopyright,
				})}
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
						{t("theme.emailFooter.unsubscribeFromTheseEmails")}
					</Link>
				</Text>
			)}
		</Section>
	);
};

export default Footer;
