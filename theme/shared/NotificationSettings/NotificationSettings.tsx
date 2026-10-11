import { component$ } from "@qwik.dev/core";
import { Form } from "@qwik.dev/router";
import { Button } from "~/components/ui/Button";
import type {
	NotificationSetting,
	SetNotificationPreferenceAction,
} from "~/contracts/notifications";

export interface NotificationSettingsProps {
	settings: NotificationSetting[];
	action: SetNotificationPreferenceAction;
}

/** The viewer's optional notifications with an on/off toggle per channel. */
export const NotificationSettings = component$<NotificationSettingsProps>(
	({ settings, action }) => (
		<ul class="space-y-2">
			{settings.map((setting) => (
				<li
					key={`${setting.notificationId}:${setting.channel}`}
					data-notification={setting.notificationId}
					data-channel={setting.channel}
					class="border border-border rounded-lg p-4 bg-white flex items-center justify-between gap-4"
				>
					<div class="min-w-0">
						<p class="font-medium text-text">
							{setting.label}{" "}
							<span class="text-sm text-text-muted">({setting.channel})</span>
						</p>
						{setting.description && (
							<p class="text-sm text-text-muted mt-1">{setting.description}</p>
						)}
					</div>
					<Form action={action} class="shrink-0 flex items-center gap-3">
						<input
							type="hidden"
							name="notificationId"
							value={setting.notificationId}
						/>
						<input type="hidden" name="channel" value={setting.channel} />
						<input
							type="hidden"
							name="enabled"
							value={setting.enabled ? "false" : "true"}
						/>
						<span class="text-sm text-text-muted" data-state>
							{setting.enabled ? "On" : "Off"}
						</span>
						<Button type="submit" size="sm" variant="secondary">
							{setting.enabled ? "Turn off" : "Turn on"}
						</Button>
					</Form>
				</li>
			))}
		</ul>
	),
);
