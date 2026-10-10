import { render } from "@react-email/render";
import * as React from "react";
import { env } from "~/env";
import { sendEmail } from "~/utils/send-email";
import LoginEmail from "~theme/emails/LoginEmail";

export const emailNotificationsService = {
	async sendLoginEmail({
		to,
		link,
		code,
		subject,
	}: {
		to: string;
		link: string;
		code: string;
		subject?: string;
	}): Promise<void> {
		const appName = env.APP_NAME;
		const element = React.createElement(LoginEmail, {
			link,
			code,
			appName,
			baseUrl: env.APP_URL,
		});
		const [html, text] = await Promise.all([
			render(element),
			render(element, { plainText: true }),
		]);

		await sendEmail({
			to,
			subject: subject ?? `Sign in to ${appName}`,
			html,
			text,
		});
	},
};
