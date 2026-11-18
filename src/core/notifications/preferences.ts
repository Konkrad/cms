import type { NotificationSetting } from "~/contracts/notifications";
import type { NotificationDefinition } from "~/core/notifications/define";
import { notificationPreferencesService } from "~/core/notifications/preferences.service";

/**
 * Preference rules on top of the table: only OPTIONAL notifications can be muted, and only
 * on a channel they declare. Server-only.
 */

/** Whether `channel` of `def` may be muted at all. */
export const isMutable = (
	def: NotificationDefinition | undefined,
	channel: string,
): def is NotificationDefinition =>
	!!def &&
	def.optional &&
	(def.channels as readonly string[]).includes(channel);

/**
 * Sets one preference. Throws for a required or unknown notification or an undeclared
 * channel, so neither the profile form nor an unsubscribe token can touch anything else.
 */
export async function setNotificationPreference(
	userId: string,
	notificationId: string,
	channel: string,
	enabled: boolean,
): Promise<void> {
	const { getNotificationDefinition } = await import(
		"~/core/registry/notifications"
	);
	if (!isMutable(getNotificationDefinition(notificationId), channel)) {
		throw new Error(
			`Notification ${notificationId} on ${channel} cannot be muted`,
		);
	}
	await notificationPreferencesService.set(
		userId,
		notificationId,
		channel,
		enabled,
	);
}

/** The user's optional notifications (core + active modules) per channel, for the profile. */
export async function listNotificationSettings(
	userId: string,
): Promise<NotificationSetting[]> {
	const { activeOptionalNotifications } = await import(
		"~/core/registry/notifications"
	);
	const stored = await notificationPreferencesService.listByUser(userId);
	const enabledOf = (notificationId: string, channel: string) =>
		stored.find(
			(p) => p.notificationId === notificationId && p.channel === channel,
		)?.enabled ?? true;
	return activeOptionalNotifications().flatMap((def) =>
		def.channels.map((channel) => ({
			notificationId: def.id,
			channel,
			label: def.label,
			description: def.description ?? null,
			enabled: enabledOf(def.id, channel),
		})),
	);
}
