/**
 * Core → theme contract for the notification settings section on `/profile`.
 */
import type { useSetNotificationPreference } from "~/routes/profile";

/** One optional notification on one channel, as the viewer's own settings. */
export interface NotificationSetting {
	notificationId: string;
	channel: string;
	label: string;
	description: string | null;
	enabled: boolean;
}

export type SetNotificationPreferenceAction = ReturnType<
	typeof useSetNotificationPreference
>;
