import type { ChannelId } from "~/core/notifications/define";
import { usersService } from "~/core/users/users.service";
import { env } from "~/env";

/**
 * Who a row goes to: user ids become addresses per channel, ops targets (messages for the
 * team, e.g. the Telegram sales channel) come from config. Server-only.
 */

interface OpsTargetConfig {
	address: () => string | undefined;
	/** Env variable named in the error when the target is not configured. */
	setting: string;
}

const OPS_TARGETS: { [K in ChannelId]?: Record<string, OpsTargetConfig> } = {
	telegram: {
		ops: {
			address: () => env.TELEGRAM_CHANNEL_ID,
			setting: "TELEGRAM_CHANNEL_ID",
		},
	},
};

/**
 * Address of an ops target, or an error when it exists but is not configured.
 * Throws on a target that does not exist (a programming error in the caller).
 */
export function resolveOpsTarget(
	channel: ChannelId,
	target: string,
): { address: string } | { error: string } {
	const config = OPS_TARGETS[channel]?.[target];
	if (!config) {
		throw new Error(`Unknown notification target ${channel}:${target}`);
	}
	const address = config.address();
	return address
		? { address }
		: {
				error: `Target ${channel}:${target} is not configured (${config.setting} is not set)`,
			};
}

/**
 * Addresses of users on a channel, looked up server-side from their ids (never taken from
 * the caller). null when the channel has no per-user address (e.g. telegram).
 */
export async function resolveUserAddresses(
	channel: ChannelId,
	userIds: string[],
): Promise<Map<string, string> | null> {
	if (channel === "email") return usersService.getEmailsByIds(userIds);
	return null;
}
