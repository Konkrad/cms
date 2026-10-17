import { createHmac, timingSafeEqual } from "node:crypto";
import { UNSUBSCRIBE_PATH } from "~/core/notifications/one-click";
import { env } from "~/env";

/**
 * Signed one-click unsubscribe tokens. A token names exactly one user, one notification and
 * one channel and can only mute that (the endpoint additionally requires the notification to
 * be optional and declare the channel). No expiry: unsubscribe links must keep working.
 *
 * Format: base64url(JSON [userId, notificationId, channel]) "." base64url(HMAC-SHA256).
 * The key is derived from MAGIC_LINK_SECRET with a purpose label, so these MACs can never be
 * confused with any other use of that secret.
 */
export interface UnsubscribeScope {
	userId: string;
	notificationId: string;
	channel: string;
}

const signingKey = () =>
	createHmac("sha256", env.MAGIC_LINK_SECRET)
		.update("notifications:unsubscribe:v1")
		.digest();

const mac = (payload: string) =>
	createHmac("sha256", signingKey()).update(payload).digest();

export function signUnsubscribeToken(scope: UnsubscribeScope): string {
	const payload = Buffer.from(
		JSON.stringify([scope.userId, scope.notificationId, scope.channel]),
	).toString("base64url");
	return `${payload}.${mac(payload).toString("base64url")}`;
}

/** The scope a token was signed for, or null when it is malformed or the MAC does not match. */
export function verifyUnsubscribeToken(token: string): UnsubscribeScope | null {
	const [payload, signature, ...rest] = token.split(".");
	if (!payload || !signature || rest.length > 0) return null;
	const expected = mac(payload);
	const given = Buffer.from(signature, "base64url");
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return null;
	}
	const parsed: unknown = JSON.parse(
		Buffer.from(payload, "base64url").toString("utf8"),
	);
	if (
		!Array.isArray(parsed) ||
		parsed.length !== 3 ||
		!parsed.every((part) => typeof part === "string" && part.length > 0)
	) {
		return null;
	}
	const [userId, notificationId, channel] = parsed as string[];
	return { userId, notificationId, channel };
}

export const unsubscribeUrl = (scope: UnsubscribeScope): string =>
	`${env.APP_URL.replace(/\/+$/, "")}${UNSUBSCRIBE_PATH}?token=${signUnsubscribeToken(scope)}`;
