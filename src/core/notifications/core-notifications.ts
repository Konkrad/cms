import type { NotificationDefinition } from "~/core/notifications/define";

/**
 * Notifications declared by core itself (same `defineNotification` shape modules use in their
 * manifest). Login OTP / magic-link emails are deliberately not here: they are sent directly
 * and synchronously by `emailNotificationsService.sendLoginEmail`, never through the outbox.
 */
export const coreNotifications: NotificationDefinition[] = [];
