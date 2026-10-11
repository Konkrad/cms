import TelegramBot from "node-telegram-bot-api";
import { env } from "~/env";

/** Why Telegram cannot send, or null when it can. */
export const telegramUnavailableReason = (): string | null =>
	env.TELEGRAM_BOT_TOKEN ? null : "TELEGRAM_BOT_TOKEN is not set";

/**
 * Sends one Telegram message; throws on failure. Only the notification channel adapter calls
 * this; everything else goes through `notify()`. A fresh bot per call reads TELEGRAM_API_URL
 * each time, so tests can point it at the mock server.
 */
export async function sendTelegramMessage(
	chatId: string,
	text: string,
): Promise<void> {
	const token = env.TELEGRAM_BOT_TOKEN;
	if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
	const bot = new TelegramBot(token, {
		polling: false,
		...(env.TELEGRAM_API_URL ? { baseApiUrl: env.TELEGRAM_API_URL } : {}),
	});
	await bot.sendMessage(chatId, text);
}

/** @deprecated Kept until the events module sends its sales alert through `notify()`. */
export const telegramService = {
	async sendNotification(message: string) {
		if (!env.TELEGRAM_CHANNEL_ID || telegramUnavailableReason()) return;
		try {
			await sendTelegramMessage(env.TELEGRAM_CHANNEL_ID, message);
		} catch (error) {
			console.error("Telegram notification failed:", error);
		}
	},
};
