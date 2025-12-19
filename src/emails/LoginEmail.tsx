import {
	Body,
	Button,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

export interface LoginEmailProps {
	link: string;
	code: string;
	appName?: string;
	expiresInMinutes?: number;
}

/**
 * LoginEmail
 *
 * Email template that contains both a magic link and a 6-letter OTP.
 * This is intentionally minimal and compatible with most email clients.
 */
export default function LoginEmail({
	link,
	code,
	appName = "Your App",
	expiresInMinutes = 15,
}: LoginEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{`Sign in to ${appName}`}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Section style={{ padding: "12px 0" }}>
						<Text style={headingStyle}>Sign in to {appName}</Text>
						<Text style={leadStyle}>
							Use the button below to sign in, or copy the 6-letter code into
							the site.
						</Text>
					</Section>

					<Section style={{ textAlign: "center", padding: "8px 0" }}>
						<Button
							pX={22}
							pY={12}
							style={{
								backgroundColor: "#0b74de",
								color: "white",
								textDecoration: "none",
								borderRadius: 8,
								display: "inline-block",
								fontWeight: 600,
							}}
							href={link}
						>
							Sign in
						</Button>
					</Section>

					<Section style={{ padding: "12px 0", textAlign: "center" }}>
						<Text style={{ fontSize: 14, marginBottom: 6 }}>
							Or enter this code
						</Text>
						<Text style={codeStyle}>{code}</Text>
						<Text style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
							The link and code expire in {expiresInMinutes} minutes.
						</Text>
					</Section>

					<Hr style={{ borderColor: "#eee", margin: "20px 0" }} />

					<Section style={{ padding: "6px 0" }}>
						<Text style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
							If you didn't request this, you can safely ignore this email.
						</Text>
						<Text style={{ fontSize: 12, color: "#999" }}>
							For security reasons, do not share your code or sign-in link with
							anyone.
						</Text>
					</Section>

					<Section style={{ paddingTop: 18 }}>
						<Text style={{ fontSize: 12, color: "#999" }}>
							{appName} · {new Date().getFullYear()}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

/* Styles */
const bodyStyle: React.CSSProperties = {
	backgroundColor: "#f6f9fc",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial',
	margin: 0,
	padding: 0,
	lineHeight: 1.4,
	color: "#111",
};

const containerStyle: React.CSSProperties = {
	backgroundColor: "white",
	borderRadius: 8,
	padding: "24px",
	boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
};

const headingStyle: React.CSSProperties = {
	fontSize: 20,
	fontWeight: 700,
	margin: 0,
	marginBottom: 8,
};

const leadStyle: React.CSSProperties = {
	fontSize: 14,
	color: "#444",
	marginTop: 0,
	marginBottom: 12,
};

const codeStyle: React.CSSProperties = {
	display: "inline-block",
	padding: "10px 16px",
	backgroundColor: "#f3f6fb",
	borderRadius: 6,
	fontSize: 18,
	fontWeight: 700,
	letterSpacing: 2,
};
