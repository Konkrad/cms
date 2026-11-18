import { routeAction$, z, zod$ } from "@qwik.dev/router";
import { requireAuth } from "~/core/auth/server-auth";
import { t } from "~/core/i18n";
import {
	isMutable,
	setNotificationPreference,
} from "~/core/notifications/preferences";
import { getNotificationDefinition } from "~/core/registry/notifications";

/**
 * Toggles one optional notification on one channel for the logged-in user (the profile's
 * notification settings, `~theme/shared/NotificationSettings`). Re-export it from the route
 * via a RELATIVE path (see useUpdateName.ts for the production-build reason).
 */
export const useSetNotificationPreference = routeAction$(
	async (data, event) => {
		const user = await requireAuth(event);
		if (
			!isMutable(getNotificationDefinition(data.notificationId), data.channel)
		) {
			return event.fail(400, { message: t("core.notifications.cannotMute") });
		}
		await setNotificationPreference(
			user.id,
			data.notificationId,
			data.channel,
			data.enabled === "true",
		);
		return { success: true };
	},
	zod$({
		notificationId: z.string().min(1),
		channel: z.string().min(1),
		enabled: z.enum(["true", "false"]),
	}),
);
