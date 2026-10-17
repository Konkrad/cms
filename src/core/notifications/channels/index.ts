import type { ChannelRegistry } from "~/core/notifications/channels/define";
import { emailChannel } from "~/core/notifications/channels/email";
import { telegramChannel } from "~/core/notifications/channels/telegram";

/** Every transport the outbox worker can send on, by channel id. */
export const channels: ChannelRegistry = {
	email: emailChannel,
	telegram: telegramChannel,
};
