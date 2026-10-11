import type { RequestEvent, RequestHandler } from "@qwik.dev/router";
import {
	isMutable,
	setNotificationPreference,
} from "~/core/notifications/preferences";
import {
	type UnsubscribeScope,
	verifyUnsubscribeToken,
} from "~/core/notifications/unsubscribe-token";
import { getNotificationDefinition } from "~/core/registry/notifications";

/**
 * One-click unsubscribe for optional notifications (link in the email footer and the
 * List-Unsubscribe header). Authorized only by the signed token, which names one user,
 * notification and channel; it can mute exactly that and nothing else.
 *
 * GET shows a confirmation with a button (link scanners prefetch GETs, so a GET never
 * changes anything); POST mutes. Mail clients use the RFC 8058 POST directly; see
 * `allowOneClickUnsubscribe` for why that POST passes Qwik's CSRF check.
 */

function authorize(event: RequestEvent) {
	const token = event.query.get("token") ?? "";
	const scope = verifyUnsubscribeToken(token);
	const def = scope
		? getNotificationDefinition(scope.notificationId)
		: undefined;
	if (!scope || !isMutable(def, scope.channel)) {
		throw event.error(400, "This unsubscribe link is invalid.");
	}
	return { token, scope, label: def.label };
}

export const onGet: RequestHandler = async (event) => {
	const { token, scope, label } = authorize(event);
	event.html(
		200,
		page(
			"Unsubscribe",
			`<p>Stop receiving <strong>${escapeHtml(label)}</strong> by ${escapeHtml(scope.channel)}?</p>
<form method="post" action="?token=${encodeURIComponent(token)}">
<button type="submit">Unsubscribe</button>
</form>`,
		),
	);
};

export const onPost: RequestHandler = async (event) => {
	const { scope, label } = authorize(event);
	await mute(scope);
	event.html(
		200,
		page(
			"Unsubscribed",
			`<p>You will no longer receive <strong>${escapeHtml(label)}</strong> by ${escapeHtml(scope.channel)}.</p>
<p>You can turn it back on in your <a href="/profile">profile</a>.</p>`,
		),
	);
};

const mute = (scope: UnsubscribeScope) =>
	setNotificationPreference(
		scope.userId,
		scope.notificationId,
		scope.channel,
		false,
	);

const escapeHtml = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] ?? c,
	);

const page = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem;">
<h1>${title}</h1>
${body}
</body></html>`;
