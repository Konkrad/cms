import { render } from "@react-email/render";
import * as React from "react";
import { t } from "~/core/i18n";
import { sendEmail } from "~/core/notifications/send-email";
import { env } from "~/env";
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
			subject: subject ?? t("core.email.login.subject", { appName }),
			html,
			text,
		});
	},
};
