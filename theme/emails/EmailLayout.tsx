/** @jsxImportSource react */

import { Body, Container, Head, Html, Tailwind } from "@react-email/components";
import type React from "react";
import { colors, fonts } from "~theme/tokens/tokens";
import Footer from "./Footer";
import Header from "./Header";

interface EmailLayoutProps {
	title: string;
	subtitle: string;
	baseUrl: string;
	/** One-click unsubscribe link for optional notifications; shown in the footer when set. */
	unsubscribeUrl?: string | null;
	children: React.ReactNode;
}

const EmailLayout = ({
	title,
	subtitle,
	baseUrl,
	unsubscribeUrl,
	children,
}: EmailLayoutProps) => {
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
						<Footer unsubscribeUrl={unsubscribeUrl} />
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default EmailLayout;
