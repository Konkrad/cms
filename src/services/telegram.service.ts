import TelegramBot from "node-telegram-bot-api";
import { env } from "~/env";

const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });

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

      await bot.sendMessage(env.TELEGRAM_CHANNEL_ID, message);
    } catch (error) {
      console.error("Telegram notification failed:", error);
    }
  },

  async sendNotification(message: string) {
    try {
      await bot.sendMessage(env.TELEGRAM_CHANNEL_ID, message);
    } catch (error) {
      console.error("Telegram notification failed:", error);
    }
  },
};
