import type { NotificationDefinition } from "~/core/notifications/define";
import { paymentReceiptNotification } from "~/core/payments/receipt";
import { reviewNotifications } from "~/core/reviews/notifications";

/**
 * Notifications declared by core itself (same `defineNotification` shape modules use in their
 * manifest). Login OTP / magic-link emails are deliberately not here: they are sent directly
 * and synchronously by `emailNotificationsService.sendLoginEmail`, never through the outbox.
 */
export const coreNotifications: NotificationDefinition[] = [
	...reviewNotifications,
	paymentReceiptNotification,
];
