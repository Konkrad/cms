/**
 * Notification declarations. Modules list theirs in the manifest (`notifications: [...]`),
 * core in `core-notifications.ts`; both are sent only through `notify(id, { to, data })`.
 * Client-safe (types and pure functions only).
 */
import type { ReactElement } from "react";

/** Transports a notification can go out on; each has an adapter in `channels.ts`. */
export const CHANNEL_IDS = ["email", "telegram"] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export interface EmailAttachment {
	filename: string;
	content: string | Buffer;
	contentType?: string;
}

/** What an email renderer returns; the email channel renders `react` to HTML and text. */
export interface EmailContent {
	subject: string;
	react: ReactElement;
	/** Built at send time (from ids in `data`), so nothing binary is stored in the outbox. */
	attachments?: EmailAttachment[];
}

/** Rendered content per channel. */
export interface ChannelContent {
	email: EmailContent;
	telegram: string;
}

/** Passed to every renderer at send time. */
export interface RenderContext {
	recipient: {
		/** null for an ops target (e.g. the Telegram sales channel). */
		userId: string | null;
		/** The user's first name, null for ops targets. */
		name: string | null;
		address: string;
	};
	appUrl: string;
	/** Signed one-click unsubscribe URL; set only for optional notifications sent to a user. */
	unsubscribeUrl: string | null;
}

type Renderer<D, K extends ChannelId> = (
	data: D,
	ctx: RenderContext,
) => ChannelContent[K] | Promise<ChannelContent[K]>;

export interface NotificationDefinition<D = Record<string, unknown>> {
	/** `<module or core area>.<name>`, e.g. "events.ticket-confirmation". */
	id: string;
	/** Shown in the profile notification settings (optional notifications only). */
	label: string;
	description?: string;
	channels: readonly ChannelId[];
	/** Optional notifications can be muted per user and channel; required ones cannot. */
	optional: boolean;
	/** One renderer per channel in `channels`. Server-only (may load data by the ids in `data`). */
	render: { [K in ChannelId]?: Renderer<D, K> };
}

const ID_PATTERN = /^[a-z0-9-]+\.[a-z0-9.-]+$/;

/**
 * Declares a notification. `D` is the shape of the `data` passed to `notify()`; it must be
 * JSON-serializable because it is stored in the outbox and rendered later by the worker.
 */
export function defineNotification<D extends Record<string, unknown>>(
	def: NotificationDefinition<D>,
): NotificationDefinition {
	if (!ID_PATTERN.test(def.id)) {
		throw new Error(
			`Notification id "${def.id}" must look like "<area>.<name>" (lowercase)`,
		);
	}
	if (def.channels.length === 0) {
		throw new Error(`Notification "${def.id}" declares no channels`);
	}
	for (const channel of def.channels) {
		if (!CHANNEL_IDS.includes(channel)) {
			throw new Error(`Notification "${def.id}": unknown channel ${channel}`);
		}
		if (!def.render[channel]) {
			throw new Error(`Notification "${def.id}" has no ${channel} renderer`);
		}
	}
	// The data type only matters at the declaration site; the registry stores them erased.
	return def as unknown as NotificationDefinition;
}

/** Indexes definitions by id. Throws on a duplicate id. */
export function indexNotifications(
	defs: readonly NotificationDefinition[],
): Map<string, NotificationDefinition> {
	const byId = new Map<string, NotificationDefinition>();
	for (const def of defs) {
		if (byId.has(def.id))
			throw new Error(`Duplicate notification id: ${def.id}`);
		byId.set(def.id, def);
	}
	return byId;
}
