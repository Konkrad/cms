import { defineChannel } from "~/core/notifications/channels/define";
import {
	sendTelegramMessage,
	telegramUnavailableReason,
} from "~/core/notifications/telegram.service";

/** Telegram Bot API. Unavailable (rows fail with the reason) while TELEGRAM_BOT_TOKEN is unset. */
export const telegramChannel = defineChannel({
	id: "telegram",
	unavailableReason: telegramUnavailableReason,
	send: ({ to, content }) => sendTelegramMessage(to, content),
});
