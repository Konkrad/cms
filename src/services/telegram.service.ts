import TelegramBot from "node-telegram-bot-api";
import { env } from "~/env";

/** Create a bot instance, reading baseApiUrl from env each time so tests can
 *  override TELEGRAM_API_URL without restarting the server. */
function getBot() {
  return new TelegramBot(env.TELEGRAM_BOT_TOKEN, {
    polling: false,
    ...(env.TELEGRAM_API_URL ? { baseApiUrl: env.TELEGRAM_API_URL } : {}),
  });
}

export const telegramService = {
  async notifyProductPurchase(params: {
    productName: string;
    quantity: number;
    amount: number;
    remainingInventory: number;
  }) {
    try {
      const message =
        `📦 Product: ${params.productName} (x${params.quantity})\n` +
        `💰 Amount: €${params.amount.toFixed(2)}\n` +
        `📊 Remaining inventory: ${params.remainingInventory}`;

      await getBot().sendMessage(env.TELEGRAM_CHANNEL_ID, message);
    } catch (error) {
      console.error("Telegram notification failed:", error);
    }
  },

  async sendNotification(message: string) {
    try {
      await getBot().sendMessage(env.TELEGRAM_CHANNEL_ID, message);
    } catch (error) {
      console.error("Telegram notification failed:", error);
    }
  },
};
