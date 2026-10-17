import { and, eq, inArray } from "drizzle-orm";
import { db } from "~/core/db/connection";
import { notificationPreferences } from "~/core/notifications/schema";

export const notificationPreferencesService = {
	/** `${userId}:${channel}` keys of the given users who muted this notification. */
	async getMuted(
		userIds: string[],
		notificationId: string,
	): Promise<Set<string>> {
		if (userIds.length === 0) return new Set();
		const rows = await db
			.select({
				userId: notificationPreferences.userId,
				channel: notificationPreferences.channel,
			})
			.from(notificationPreferences)
			.where(
				and(
					inArray(notificationPreferences.userId, userIds),
					eq(notificationPreferences.notificationId, notificationId),
					eq(notificationPreferences.enabled, false),
				),
			);
		return new Set(rows.map((r) => `${r.userId}:${r.channel}`));
	},

	/** The user's stored preferences (rows only exist for toggled notifications). */
	async listByUser(userId: string) {
		return db
			.select({
				notificationId: notificationPreferences.notificationId,
				channel: notificationPreferences.channel,
				enabled: notificationPreferences.enabled,
			})
			.from(notificationPreferences)
			.where(eq(notificationPreferences.userId, userId));
	},

	/**
	 * Upserts one preference. Callers validate first (`setNotificationPreference`): only
	 * optional notifications on one of their channels may be muted.
	 */
	async set(
		userId: string,
		notificationId: string,
		channel: string,
		enabled: boolean,
	): Promise<void> {
		const updatedAt = new Date().toISOString();
		await db
			.insert(notificationPreferences)
			.values({ userId, notificationId, channel, enabled, updatedAt })
			.onConflictDoUpdate({
				target: [
					notificationPreferences.userId,
					notificationPreferences.notificationId,
					notificationPreferences.channel,
				],
				set: { enabled, updatedAt },
			});
	},
};
