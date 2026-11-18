import type { ChannelContent, ChannelId } from "~/core/notifications/define";

export interface ChannelMessage<K extends ChannelId> {
	/** The address stored on the outbox row (email address, chat id). */
	to: string;
	content: ChannelContent[K];
	/** Signed one-click unsubscribe URL for optional notifications to a user, else null. */
	unsubscribeUrl: string | null;
}

/** A transport adapter. The worker picks it by the outbox row's `channel`. */
export interface ChannelDefinition<K extends ChannelId = ChannelId> {
	id: K;
	/**
	 * Why the channel cannot send (disabled or unconfigured), or null when it can. The worker
	 * marks such rows failed with this reason instead of retrying; an admin re-queues them
	 * once the channel is configured.
	 */
	unavailableReason(): string | null;
	/** Sends one message; throws on failure (the worker retries with backoff). */
	send(message: ChannelMessage<K>): Promise<void>;
}

export type ChannelRegistry = { [K in ChannelId]: ChannelDefinition<K> };

export function defineChannel<K extends ChannelId>(
	def: ChannelDefinition<K>,
): ChannelDefinition<K> {
	return def;
}
