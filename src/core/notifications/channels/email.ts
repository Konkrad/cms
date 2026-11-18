import { render } from "@react-email/render";
import { defineChannel } from "~/core/notifications/channels/define";
import { sendEmail } from "~/core/notifications/send-email";

/** SMTP via `sendEmail`. SMTP settings are required by `src/env.ts`, so it is always available. */
export const emailChannel = defineChannel({
	id: "email",
	unavailableReason: () => null,
	async send({ to, content, unsubscribeUrl }) {
		const [html, text] = await Promise.all([
			render(content.react),
			render(content.react, { plainText: true }),
		]);
		await sendEmail({
			to,
			subject: content.subject,
			html,
			text,
			attachments: content.attachments,
			// RFC 2369 + RFC 8058 one-click unsubscribe (mail clients POST to the URL).
			headers: unsubscribeUrl
				? {
						"List-Unsubscribe": `<${unsubscribeUrl}>`,
						"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
					}
				: undefined,
		});
	},
});
